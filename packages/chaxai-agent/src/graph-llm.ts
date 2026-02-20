import { IChaxStreamChunk, IMessage } from "@chaxai-common";

/**
 * LLM 工具调用结构
 */
export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
}

/**
 * 历史对话消息
 * 仅包含用户和助手角色，用于持久化存储
 */
export interface HistoryMessage extends IMessage {
    role: 'user' | 'assistant';
}

/**
 * 工具调用结果消息
 */
export interface ToolMessage extends IMessage {
    role: 'tool';
    tool_call_id: string;
}

/**
 * AI 助手消息
 * 可能包含工具调用请求和工具执行结果
 */
export interface AIMessageInAgent extends IMessage {
    role: 'assistant';
    tool_calls?: ToolCall[];
    tool_result?: ToolMessage[];
}

/**
 * 用户消息
 */
export interface UserMessageInAgent extends IMessage {
    role: 'user';
}

/**
 * 系统消息
 */
export interface SystemMessageInAgent extends IMessage {
    role: 'system';
}

export interface AgentMessageExentd  {
    title?:string 
}

/**
 * Agent 中所有消息的联合类型
 */
export type AgentMessage = (AIMessageInAgent
    | UserMessageInAgent
    | SystemMessageInAgent
    | ToolMessage
) & AgentMessageExentd;


/**
 * Agent 执行状态
 */
export interface AgentState {
    /** 历史对话记录（已完成的轮次） */
    history: HistoryMessage[];
    /** 当前执行上下文（多轮 LLM 调用产生的消息） */
    context: AgentMessage[];
    /** 流式输出回调 */
    sendChunk: (chunk: IChaxStreamChunk) => void;
}
