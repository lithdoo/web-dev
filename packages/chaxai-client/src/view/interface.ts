/**
 * 聊天历史记录接口
 * 用于展示用户的历史对话列表
 */
export interface IRecChaxHistory {
    isOpen: boolean
    /** 当前激活的对话ID */
    active?: string
    /** 对话列表，包含每个对话的标题、更新时间等基本信息 */
    list: {
        /** 对话标题 */
        title: string
        /** 对话最后更新时间，Unix时间戳格式 */
        updateTime: number
        /** 对话唯一标识ID */
        conversationId: string
    }[]

    /** 选择对话时的回调函数 */
    onSelect?: (id: string) => void
    /** 新建对话时的回调函数 */
    onNewChat?: () => void
    /** 删除对话时的回调函数 */
    onDelete?: (id: string) => void

    open():void
    close():void
}


/**
 * 聊天输入框接口
 * 定义聊天输入组件的各类状态和属性
 */
export interface IRecChaxInput {
    /** 输入框是否获得焦点 */
    isFocus: boolean
    /** 输入框是否被禁用，禁用时无法输入和提交 */
    isDisabled: boolean
    /** 是否正在加载中 */
    loading: boolean
    /** 用户输入的内容 */
    userInput: string
    /** 输入框占位文本，引导用户输入 */
    placeholder: string
    /** 可用工具列表，用于扩展输入功能 */
    tools: Array<{
        /** 工具类型标识 */
        type: string
        /** 工具选项列表 */
        options: string[]
    }>
    
    /** 发送消息时的回调函数 */
    onSend?: (content: string) => void
    /** 输入框获得焦点时的回调函数 */
    onFocus?: () => void
    /** 输入框失去焦点时的回调函数 */
    onBlur?: () => void
}


/**
 * 聊天消息接口
 * 定义单条聊天消息的所有属性
 */
export interface IRecChaxMessage {
    /** 消息唯一标识ID */
    msgId: string
    /** 消息内容，支持富文本或Markdown格式 */
    content: string
    /** 消息是否未完成，用于流式响应场景 */
    unfinished: boolean
    /** 错误信息，当消息发送或处理失败时填充 */
    error?: string
    /** 消息发送者类型，user为用户发送，assistant为AI回复 */
    type: 'user' | 'assistant'
    /** 消息创建时间，Unix时间戳格式 */
    createTime: number
    /** 消息更新回调，用于滚动到 Coversation 底部 */
    onUpdate?: (msg: IRecChaxMessage) => void
}

/**
 * 聊天会话接口
 * 定义单个聊天会话的完整信息
 */
export interface IRecChaxCoversation {
    /** 会话中的消息列表 */
    msgList: IRecChaxMessage[]
    /** 会话唯一标识ID */
    conversationId: string
    /** 会话标题，通常为对话的第一条消息或用户指定 */
    title: string
    /** 会话最后更新时间，Unix时间戳格式 */
    updateTime: number
    
    /** 会话滚动到底部的回调函数 */
    onScrollToBottom?: () => void
}


/**
 * 主聊天接口
 * 整合聊天应用的完整状态，用于顶层组件的数据传递
 */
export interface IRecChax {
    /** 当前活跃的会话，切换会话时更新 */
    current?: IRecChaxCoversation
    /** 用户的历史对话记录 */
    history: IRecChaxHistory
    /** 输入框组件的状态和配置 */
    input: IRecChaxInput
    /** Markdown渲染配置，用于自定义消息内容的渲染方式 */
    markdown: {
        /** 自定义渲染器实现 */
        renderer: any
        /** 渲染键类型配置 */
        keyType: any
    }
    /** 是否有正在进行的Server-Send Events连接，用于流式消息接收 */
    hasSSE: boolean
}
