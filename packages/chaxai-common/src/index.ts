/**
 * ChaxAI 通用类型定义
 * 定义了 AI 聊天系统的核心数据结构、客户端接口、服务接口和 API 路径配置
 */

/**
 * DeepSeek 消息基础结构
 * 定义消息的角色和内容
 */
export interface DeepSeekMessage {
    /** 消息发送者角色 - user: 用户发送, assistant: AI 回复, system: 系统提示 */
    role: 'user' | 'assistant' | 'system';
    /** 消息文本内容 */
    content: string;
}

/**
 * 流式消息块结构
 * 用于流式传输消息内容，支持多种块类型
 */
export interface IChaxStreamChunk {
    /** 块类型 - chunk: 数据块, init: 初始化, done: 完成, error: 错误 */
    type: 'chunk' | 'init' | 'done' | 'error';
    /** 块内容文本 */
    content: string;
}

/**
 * 聊天消息结构
 * 表示单条聊天消息的完整信息
 */
export interface IChaxMessage {
    /** 消息唯一标识符 */
    msgId: string;
    /** 消息角色，继承 DeepSeekMessage 的角色类型 */
    role: DeepSeekMessage['role'];
    /** 消息是否在客户端显示 */
    visiableInClient: boolean;
    /** 消息是否未完成（流式传输时可能用到） */
    unfinished?: boolean;
    /** 错误信息（如果消息发送失败） */
    error?: string;
}

/**
 * 聊天会话结构
 * 表示一个完整的聊天会话，包含会话的基本信息和时间戳
 */
export interface IChaxConversation {
    /** 会话唯一标识符 */
    conversationId: string;
    /** 会话创建时间戳（毫秒） */
    createTimestamp: number;
    /** 会话最后更新时间戳（毫秒） */
    updateTimestamp: number;
    /** 会话标题 */
    title: string;
}

/**
 * ChaxAI 客户端接口
 * 定义客户端与后端交互的方法
 */
export interface IChaxClient {
    /** 获取所有聊天会话列表 */
    fetchChatConversations(): Promise<IChaxConversation[]>;
    /** 获取指定会话的消息列表 */
    fetchChatMessages(conversationId: string): Promise<IChaxMessage[]>;
    /** 发送聊天消息，可指定会话 ID，不指定则创建新会话 */
    sendChatMessage(message: string, conversationId?: string): Promise<IChaxConversation>;
    /** 获取单条消息的完整内容 */
    fetchContentMessage(msgId: string): Promise<{ content: string, error: string }>;
    /** 流式获取消息内容，通过回调函数逐块接收数据 */
    fetchStreamMessage(msgId: string, onChunk: (chunk: IChaxStreamChunk) => void): Promise<void>;
}


export interface IChaxHistroyService {
    /** 处理获取所有聊天会话列表的请求 */
    onFetchChatConversations(): Promise<IChaxConversation[]>;
    /** 处理获取指定会话消息列表的请求 */
    onFetchChatMessages(conversationId: string): Promise<IChaxMessage[]>;
    /** 处理获取单条消息内容的请求 */
    onFetchContentMessage(msgId: string): Promise<{ content: string, error: string }>;
}

/**
 * ChaxAI 服务接口
 * 定义服务端处理请求的方法
 */
export interface IChaxService extends IChaxHistroyService {
    /** 处理发送聊天消息的请求 */
    onSendChatMessage(message: string, conversationId?: string): Promise<IChaxConversation>;
    /** 处理流式获取消息内容的请求 */
    onFetchStreamMessage(msgId: string, onChunk: (chunk: IChaxStreamChunk) => void): Promise<void>;
}


export interface IChaxConversationManager {
    onCreateConversation(message: string): Promise<IChaxConversation>;
    onContinueConversation(conversationId: string, onChunk: (chunk: IChaxStreamChunk) => void): void;
}


export interface IChaxConversationManagerBuilder  {
    build(histroy: IChaxHistroyService): IChaxConversationManager;
}

/**
 * ChaxAI API 路径配置
 * 定义所有 API 端点的路径、方法和参数
 */
export const ChaxApiPath = {
    /** 获取聊天记录列表 */
    fetchChatRecords: {
        path: '/ai/record/list',
        method: 'GET',
    },
    /** 获取指定会话的消息列表 */
    fetchChatMessages: {
        path: '/ai/message/list/{recordId}',
        method: 'GET',
        args: {
            recordId: 'recordId',
        },
    },
    /** 发送聊天消息 */
    sendChatMessage: {
        path: '/ai/chat',
        method: 'POST',
        args: {
            recordId: 'recordId',
            content: 'content',
        },
    },
    /** 获取单条消息的完整内容 */
    fetchContentMessage: {
        path: '/ai/message/content/{msgId}',
        method: 'GET',
        args: {
            msgId: 'msgId',
        },
    },
    /** 流式获取消息内容 */
    fetchStreamMessage: {
        path: '/ai/message/stream/{msgId}',
        method: 'GET',
        args: {
            msgId: 'msgId',
        },
    },
};
