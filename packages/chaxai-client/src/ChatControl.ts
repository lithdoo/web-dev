import type { IChaxMessage, IChaxConversation } from "@chaxai-common"
import { defaultRenderer, defaultRendererKeyType, type MarkdownNodeRenderer, type MarkdownNodeRenderKeyType } from "./ASTNode/render"
import { TabControl } from "./TabControl"


export interface IChaxReq<T = any> {
    fetchAllConversation(): Promise<IChaxConversation[]>
    fetchAllMessage(recordId: string): Promise<IChaxMessage[]>
    fetchContent(msgId: string): Promise<{ content: string, error?: string }>
    send(input: {
        recordId?: string
        content: string,
        extra: T
    }): Promise<{ recordId: string }>

    sseContent(msgId: string): EventSource
}

export class ChaxReq<T = any> implements IChaxReq<T> {
    async fetchAllConversation(): Promise<IChaxConversation[]> {
        const res = await fetch('/ai/record/list')
        return await res.json()
    }

    async fetchAllMessage(recordId: string): Promise<IChaxMessage[]> {
        const res = await fetch(`/ai/message/list/${recordId}`)
        return await res.json()
    }

    async fetchContent(msgId: string): Promise<{ content: string; error?: string }> {
        const res = await fetch(`/ai/message/content/${msgId}`)
        const content = await res.text()
        return { content }
    }

    async send(input: { recordId?: string; content: string; extra: T }): Promise<{ recordId: string }> {
        const res = await fetch('/ai/chat', {
            body: JSON.stringify({
                recordId: input.recordId || null,
                content: input.content,
                extra: input.extra
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
        })
        return await res.json()
    }

    sseContent(msgId: string): EventSource {
        return new EventSource(`/ai/message/content/sse/${msgId}`)
    }
}

export class SSEMessage {
    content: string = ''
    error?: string
    source?: EventSource
    request: IChaxReq

    constructor(public msgId: string, option?: { request?: IChaxReq }) {
        this.request = option?.request ?? new ChaxReq()
    }

    start() {
        this.source = this.request.sseContent(this.msgId)

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
            this.source = undefined
            this.onClose?.()
        }
    }

    onClose?: () => void
    onUpdate?: () => void
}

export class MsgBox {
    msgList: { [key: string]: IChaxMessage[] } = {}
    msgContent: { [key: string]: string } = {}
    msgSSE: { [key: string]: SSEMessage } = {}
    request: IChaxReq

    constructor(option?: { request?: IChaxReq }) {
        this.request = option?.request ?? new ChaxReq()
    }

    hasSSE() {
        return !![...Object.values(this.msgSSE)].length
    }

    async reload(recordId: string) {
        // 关闭所有当前SSE连接
        this.closeAllSSE()
        
        const data = await this.request.fetchAllMessage(recordId)
        this.msgList[recordId] = data
        this.msgList[recordId].filter(v => {
            return v.unfinished
        }).forEach(msg => {
            const sse = new SSEMessage(msg.msgId, { request: this.request })
            this.msgSSE[msg.msgId] = sse
            sse.start()
            sse.onClose = () => {
                delete this.msgSSE[msg.msgId]
            }
        })
    }

    async content(msgId: string, useCache = true) {
        if (useCache && this.msgContent[msgId]) return this.msgContent[msgId]
        const data = await this.request.fetchContent(msgId)
        this.msgContent[msgId] = data.content
        return data.content
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
    }

    async refresh(): Promise<void> {
        if (this.currentId) {
            await this.msgbox.reload(this.currentId)
        }
    }

    async loadRecords() {
        const data = await this.request.fetchAllConversation()
        this.list = data
    }

    async init() {
        this.input.onSubmit = (text) => {
            this.send(text)
        }
        await this.loadRecords()
    }

    async load(id: string | null) {
        if (!id) {
            this.currentId = null
            return
        }

        if (this.list.some(v => v.conversationId === id)) {
            this.currentId = id
            await this.refresh()
        }
    }

    async send(content: string) {
        const extra = this.beforeSend?.(content)
        if (extra === false) return

        const result = await this.request.send({
            recordId: this.currentId || undefined,
            content,
            extra
        })

        await this.loadRecords()
        await this.load(result.recordId)
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

