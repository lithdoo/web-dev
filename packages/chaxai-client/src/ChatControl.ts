import type { IChaxMessageInfo, IChaxConversation } from "@chaxai-common"
import { defaultRenderer, defaultRendererKeyType, type MarkdownNodeRenderer, type MarkdownNodeRenderKeyType } from "./ASTNode/render"
import { TabControl } from "./TabControl"


export interface IChaxReq<T = any> {
    fetchAllConversation(): Promise<IChaxConversation[]>
    fetchAllMessage(conversationId: string): Promise<IChaxMessageInfo[]>
    fetchContent(msgId: string): Promise<{ content: string, error?: string }>
    send(input: {
        conversationId?: string
        content: string,
        extra: T
    }): Promise<{ conversationId: string }>

    sseContent(msgId: string): EventSource
}

export class ChaxReq<T = any> implements IChaxReq<T> {
    async fetchAllConversation(): Promise<IChaxConversation[]> {
        const res = await fetch('/ai/record/list')
        return await res.json()
    }

    async fetchAllMessage(conversationId: string): Promise<IChaxMessageInfo[]> {
        const res = await fetch(`/ai/message/list/${conversationId}`)
        return await res.json()
    }

    async fetchContent(msgId: string): Promise<{ content: string; error?: string }> {
        const res = await fetch(`/ai/message/content/${msgId}`)
        const data = await res.json()
        return data
    }

    async send(input: { conversationId?: string; content: string; extra: T }): Promise<{ conversationId: string }> {
        const res = await fetch('/ai/chat', {
            body: JSON.stringify({
                conversationId: input.conversationId || null,
                content: input.content,
                extra: input.extra
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
        })
        return await res.json()
    }

    sseContent(msgId: string): EventSource {
        return new EventSource(`/ai/message/stream/${msgId}`)
    }
}

export class SSEMessage {
    content: string = ''
    error?: string
    source?: EventSource | null
    request: IChaxReq
    private isStarted: boolean = false

    constructor(public msgId: string, option?: { request?: IChaxReq }) {
        this.request = option?.request ?? new ChaxReq()
        this.source = null
    }

    start() {
        if (this.isStarted) return
        this.isStarted = true

        this.source = this.request.sseContent(this.msgId)

        if (!this.source) {
            this.error = 'SSE 连接创建失败'
            this.isStarted = false
            this.onUpdate?.()
            return
        }

        this.source.onmessage = (event) => {
            const data = event.data
            try {
                const { type, content } = JSON.parse(data)
                if (type === 'chunk') {
                    this.content = this.content + content
                    this.onUpdate?.()
                } else if (type === 'init') {
                    this.content = content
                    this.onUpdate?.()
                } else if (type === 'done') {
                    this.onUpdate?.()
                    this.close()
                } else if (type === 'error') {
                    this.error = content
                    this.onUpdate?.()
                    this.close()
                }
            } catch (e) {
                this.error = e instanceof Error ? e.message : '未知错误'
                console.error(e)
                this.onUpdate?.()
                this.close()
            }
        }

        this.source.onerror = (error) => {
            this.error = 'SSE连接错误'
            console.error('SSE error:', error)
            this.onUpdate?.()
            this.close()
        }
    }

    close() {
        if (this.source) {
            this.source.close()
            this.source = null
            this.isStarted = false
            this.onClose?.()
        }
    }

    onClose?: () => void
    onUpdate?: () => void
}

export class MsgBox {
    msgList: { [key: string]: IChaxMessageInfo[] } = {}
    msgContent: {
        [key: string]: {
            content: string,
            error?: string
        }
    } = {}
    msgSSE: { [key: string]: SSEMessage } = {}
    request: IChaxReq

    constructor(option?: { request?: IChaxReq }) {
        this.request = option?.request ?? new ChaxReq()
    }

    hasSSE() {
        return !![...Object.values(this.msgSSE)].length
    }

    async reload(conversationId: string) {
        // 关闭所有当前SSE连接
        this.closeAllSSE()
        this.msgListener = []

        const data = await this.request.fetchAllMessage(conversationId)
        this.msgList[conversationId] = data
        this.msgList[conversationId].filter(v => {
            return v.unfinished
        }).forEach(msg => {
            const sse = new SSEMessage(msg.msgId, { request: this.request })
            this.msgSSE[msg.msgId] = sse
            sse.start()
            sse.onClose = () => {
                delete this.msgSSE[msg.msgId]
                this.msgListener.forEach(listener => {
                    if (listener.msgId === msg.msgId) {
                        listener.onUpdate(sse.error, sse.content, true)
                    }
                })
                this.msgListener = this.msgListener.filter(listener => listener.msgId !== msg.msgId)

            }
            sse.onUpdate = () => {
                this.msgListener.forEach(listener => {
                    if (listener.msgId === msg.msgId) {
                        listener.onUpdate(sse.error, sse.content, false)
                    }
                })
            }
        })

        this.msgList[conversationId].filter(v => {
            return v.unfinished
        }).forEach(msg => {
            const sse = new SSEMessage(msg.msgId, { request: this.request })
            this.msgSSE[msg.msgId] = sse
            sse.start()
            sse.onClose = () => {
                delete this.msgSSE[msg.msgId]
                this.msgListener.forEach(listener => {
                    if (listener.msgId === msg.msgId) {
                        listener.onUpdate(sse.error, sse.content, true)
                    }
                })
                this.msgListener = this.msgListener.filter(listener => listener.msgId !== msg.msgId)

            }
            sse.onUpdate = () => {
                this.msgListener.forEach(listener => {
                    if (listener.msgId === msg.msgId) {
                        listener.onUpdate(sse.error, sse.content, false)
                    }
                })
            }
        })
        this.reloadWatcher.forEach(watcher => {
            if (watcher.conversationId === conversationId) {
                watcher.onUpdate()
            }
        })
    }

    async content(msgId: string, useCache = true) {
        if (useCache && this.msgContent[msgId]) return this.msgContent[msgId]
        const data = await this.request.fetchContent(msgId)
        this.msgContent[msgId] = {
            content: data.content,
            error: data.error
        }
        return data
    }

    closeAllSSE() {
        Object.values(this.msgSSE).forEach(sse => {
            sse.close()
        })
        this.msgSSE = {}
    }

    closeSSE(msgId: string) {
        if (this.msgSSE[msgId]) {
            this.msgSSE[msgId].close()
            delete this.msgSSE[msgId]
        }
    }

    msgListener: {
        msgId: string
        onUpdate: (error: string | undefined, content: string, isDone: boolean) => void
    }[] = []


    addMsgListener(
        msgId: string,
        onUpdate: (error: string | undefined, content: string, isDone: boolean) => void

    ) {
        this.msgListener.push({
            msgId,
            onUpdate
        })
    }

    removeMsgListener(msgId: string) {
        this.msgListener = this.msgListener.filter(v => v.msgId !== msgId)
    }


    reloadWatcher: {
        conversationId: string
        onUpdate: () => void
    }[] = []

    addReloadWatcher(
        conversationId: string,
        onUpdate: () => void
    ) {
        this.reloadWatcher.push({
            conversationId,
            onUpdate
        })
    }

    removeReloadWatcher(conversationId: string) {
        this.reloadWatcher = this.reloadWatcher.filter(v => v.conversationId !== conversationId)
    }



}


export class AIInputControl {

    isFocus: boolean = false
    isDisabled: boolean = false
    userInput: string = ''
    placeholder: string = '请输入需求，功能点…'
    tools = [{
        type: 'selector',
        options: ['DeepSeek-R1-32B']
    }]

    submit() {
        if (this.isDisabled) return
        this.onSubmit?.(this.userInput)
        this.userInput = ''
    }

    onSubmit?: (userInput: string) => void
}

export class ChatControl {
    currentId: string | null = null
    list: IChaxConversation[] = []
    msgbox: MsgBox
    input = new AIInputControl()
    markdown: {
        renderer: MarkdownNodeRenderer
        keyType: MarkdownNodeRenderKeyType
    } = { renderer: defaultRenderer, keyType: defaultRendererKeyType }
    request: IChaxReq

    constructor(option?: { request?: IChaxReq }) {
        this.request = option?.request ?? new ChaxReq()
        this.msgbox = new MsgBox({ request: this.request })
        this.input.onSubmit = (text) => {
            this.send(text)
        }
    }

    async refresh(): Promise<void> {
        if (this.currentId) {
            await this.msgbox.reload(this.currentId)
        }
    }

    async loadRecords() {
        const data = await this.request.fetchAllConversation()
        this.list = data
        this.onReloadConversationList?.()
    }

    async init() {
        await this.loadRecords()
        this.input.onSubmit = (text) => {
            this.send(text)
        }
    }

    async load(id: string | null) {
        if (!id) {
            this.currentId = null
            this.onConversationChange?.()
            return
        }

        if (this.list.some(v => v.conversationId === id)) {
            this.currentId = id
            await this.refresh()
            this.onConversationChange?.()
        }
    }

    onConversationChange?: () => void
    onReloadConversationList?: () => void


    async send(content: string) {
        const extra = this.beforeSend?.(content)
        if (extra === false) return

        const result = await this.request.send({
            conversationId: this.currentId || undefined,
            content,
            extra
        })

        await this.loadRecords()
        await this.load(result.conversationId)
    }

    beforeSend?(content: string): any | false
    afterSend?(): void
}

export class ChatControlWithTab extends ChatControl {
    tab: TabControl = new TabControl()
    constructor(option?: { request?: IChaxReq }) {
        super(option)
    }
}

