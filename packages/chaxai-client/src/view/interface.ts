


export interface IRecChaxHistory {
    list: {
        title: string
        updateTime: number
        conversationId: string
    }[]
}


export interface IRecChaxInput {
    isFocus: boolean
    isDisabled: boolean
    userInput: string
    placeholder: string
    tools: Array<{
        type: string
        options: string[]
    }>
}


export interface IRecChaxMessage {
    msgId: string
    content: string
    unfinished: boolean
    error?: string
    type: 'user' | 'assistant'
    createTime: number
}


// 
export interface IRecChaxCoversation {
    msgList: IRecChaxMessage[]
    conversationId: string
    title: string
    updateTime: number
}


export interface IRecChax {
    current?: IRecChaxCoversation
    history: IRecChaxHistory
    input: IRecChaxInput
    markdown: {
        renderer: any
        keyType: any
    }
    hasSSE: boolean
}