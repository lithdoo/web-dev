import { IChaxStreamChunk } from "@chaxai-common";

export interface IAgxntLLMResponse {
    content?: string;
    tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
            name?: string;
            arguments?: string;
        };
    }>;
    tool_choice?: any;
}


export interface IAgxntTool {
    info: {
        type: "function",
        function: {
            name: string,
            description: string,
            parameters: Record<string, any>
        }
    },
    call: (args: any) => Promise<string>
}


export interface IAgxntLLM {
    bindTools(tools: IAgxntTool[]): IAgxntLLM;
    setMessages(messages: Array<{ role: string; content: string }>): IAgxntLLM;
    send(onChunk?: (chunk: IChaxStreamChunk) => void): Promise<IAgxntLLMResponse>;
    steam(onChunk?: (chunk: IChaxStreamChunk) => void): Promise<{
        content?: string
    }>;
}