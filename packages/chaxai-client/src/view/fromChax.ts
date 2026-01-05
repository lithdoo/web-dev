import { ChatControl, AIInputControl, MsgBox } from "@/ChatControl"
import { IChaxConversation, IChaxMessage } from "@chaxai-common"
import { Ref, computed, markRaw, reactive, ref } from "vue"
import { IRecChax, IRecChaxCoversation, IRecChaxHistory, IRecChaxInput, IRecChaxMessage } from "./interface"



export class RecChaxInput implements IRecChaxInput {
    static cache: WeakMap<AIInputControl, RecChaxInput> = new WeakMap()
    static from(target: AIInputControl): RecChaxInput {
        let input = this.cache.get(target)
        if (!input) {
            input = new RecChaxInput(target)
            this.cache.set(target, input)
        }
        return input
    }

    isFocus: boolean = false
    isDisabled: boolean = false
    loading: boolean = false
    userInput: string = ''
    placeholder: string = '请输入需求，功能点…'
    tools = [{
        type: 'selector',
        options: ['DeepSeek-R1-32B']
    }]

    submit() {
        this.updateToTarget()
        this.target.submit()
        this.updateFromTarget()
    }

    constructor(
        protected target: AIInputControl
    ) {
        markRaw(target)
    }


    updateFromTarget() {
        this.isFocus = this.target.isFocus
        this.isDisabled = this.target.isDisabled
        this.placeholder = this.target.placeholder
        this.tools = this.target.tools
        this.userInput = this.target.userInput
    }

    updateToTarget() {
        this.target.isFocus = this.isFocus
        this.target.isDisabled = this.isDisabled
        this.target.placeholder = this.placeholder
        this.target.tools = this.tools
        this.target.userInput = this.userInput
    }

    onBlur() {
        this.isFocus = false
        this.updateToTarget()
    }

    onFocus() {
        this.isFocus = true
        this.updateToTarget()
    }

    onSend(content: string) {
        this.userInput = content
        this.submit()
    }
}

export class RecChaxMessage implements IRecChaxMessage {

    static cache: WeakMap<IChaxMessage, RecChaxMessage> = new WeakMap()
    static from(msg: IChaxMessage, box: MsgBox): RecChaxMessage {
        let message = this.cache.get(msg)
        if (!message) {
            message = reactive(new RecChaxMessage(msg, box)) as RecChaxMessage
            message.init()
            this.cache.set(msg, message)
        }
        return message
    }

    msgId: string = ''
    content: string = ''
    unfinished: boolean = false
    error?: string = undefined
    type: 'user' | 'assistant' = 'user'
    // 暂时不实现
    createTime: number = 0;

    constructor(
        protected msg: IChaxMessage,
        protected box: MsgBox
    ) {
        markRaw(msg)
        markRaw(box)

        this.msgId = msg.msgId
        this.type = msg.role === 'user' ? 'user' : 'assistant'

    }


    init() {
        const updateListner = (error: string | undefined, content: string, isDone: boolean) => {
            this.error = error
            this.content = content
            this.unfinished = !isDone
        }

        this.box.addMsgListener(this.msgId, updateListner)
    }

    dispose() {
        this.box.removeMsgListener(this.msgId)
        RecChaxMessage.cache.delete(this.msg)
    }
}

export class RecChaxConversation implements IRecChaxCoversation {

    static cache: WeakMap<IChaxConversation, RecChaxConversation> = new WeakMap()
    static from(target: IChaxConversation, box: MsgBox): RecChaxConversation {
        let conversation = this.cache.get(target)
        if (!conversation) {
            conversation = reactive(new RecChaxConversation(target, box)) as RecChaxConversation
            conversation.init()
            this.cache.set(target, conversation)
        }
        return conversation
    }

    msgList: IRecChaxMessage[] = []
    conversationId: string = ''
    title: string = ''
    updateTime: number = 0


    constructor(
        protected target: IChaxConversation,
        private box: MsgBox
    ) {
        markRaw(target)
        markRaw(box)
        this.conversationId = target.conversationId
        this.title = target.title
        this.updateTime = target.updateTimestamp

    }

    init() {
        this.box.addReloadWatcher(this.conversationId, () => {
            this.updateMessageList()
        })
        this.updateMessageList()
    }

    updateMessageList() {
        const list = this.box.msgList[
            this.conversationId
        ] ?? []

        this.msgList.forEach(v => v.onUpdate = undefined)

        this.msgList = list.map(msg => RecChaxMessage.from(msg, this.box))

        this.msgList.forEach(v => v.onUpdate = () => {
            // this.onScrollToBottom?.()
        })
    }
}

export class RecChax {

    static cache: WeakMap<ChatControl, Ref<IRecChax>> = new WeakMap()


    static createRef(target: ChatControl): Ref<IRecChax> {
        if (this.cache.has(target)) {
            return this.cache.get(target)!
        }

        markRaw(target)

        const input = ref(RecChaxInput.from(target.input))
        const markdown = target.markdown
        const conversations = ref(target.list.map(v => RecChaxConversation.from(
            v, target.msgbox
        )))
        const currentId = ref(target.currentId)


        target.onConversationChange = () => {
            currentId.value = target.currentId
        }


        target.onReloadConversationList = () => {
            conversations.value = target.list.map(v => RecChaxConversation.from(
                v, target.msgbox
            ))
        }

        const isHistoryOpen = ref(false)

        const histroy: Ref<IRecChaxHistory> = computed(() => {
            return {
                isOpen: isHistoryOpen.value,
                active: currentId.value ?? undefined,
                list: conversations.value.map(v => ({
                    conversationId: v.conversationId,
                    title: v.title,
                    updateTime: v.updateTime,
                })),
                close: () => {
                    isHistoryOpen.value = false
                },
                open: () => {
                    isHistoryOpen.value = true
                },

                onDelete: (_id: string) => {
                    // target.request.deleteConversation(id)
                },
                onNewChat: () => {
                    isHistoryOpen.value = false
                    target.load(null)
                },
                onSelect:(id: string) => {
                    isHistoryOpen.value = false
                    target.load(id)
                },
        
            }
        })


        const recChax: Ref<IRecChax> = computed(() => {
            const current = conversations.value.find(v => v.conversationId === currentId.value)
            const hasSSE = current?.msgList.some(v => v.type === 'assistant' && v.unfinished)
            return {
                current: current,
                history: histroy.value,
                hasSSE: hasSSE ?? false,
                input: input.value,
                markdown,
            }
        })
        return recChax
    }



}