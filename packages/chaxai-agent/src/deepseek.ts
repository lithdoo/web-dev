import { IAgxntLLM, IAgxntTool, IAgxntLLMResponse } from "./interface";
import { IChaxStreamChunk } from "@chaxai-common";

const API_KEY = "sk-5069284b93a7481db08a15f65628906a";
const BASE_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";

interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content?: string;
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    }>;
    tool_call_id?: string;
}

interface StreamChunk {
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
    done?: boolean;
}

function parseSSEChunk(chunk: string): StreamChunk | null {
    const lines = chunk.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
                return { done: true };
            }
            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (delta) {
                    return {
                        content: delta.content,
                        tool_calls: delta.tool_calls
                    };
                }
            } catch (e) {
            }
        }
    }
    return null;
}

async function* callDeepseekStream(
    messages: Message[],
    tools?: IAgxntTool[],
    options?: {
        temperature?: number;
        model?: string;
        tool_choice?: "auto" | "none" | "required";
    }
): AsyncGenerator<StreamChunk> {
    const payload: any = {
        model: options?.model || MODEL,
        messages,
        temperature: options?.temperature || 0.7,
        // max_tokens: options?.max_tokens || 1024,
        stream: true,
    };

    if (tools && tools.length > 0) {
        payload.tools = tools.map(t => ({
            type: t.info.type,
            function: t.info.function
        }));
        payload.tool_choice = options?.tool_choice || "auto";
    }

    const response = await fetch(BASE_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("无法获取响应流");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const chunk = parseSSEChunk(line);
            if (chunk) {
                yield chunk;
            }
        }
    }
}

interface ToolHandler {
    (args: Record<string, any>): string | Promise<string>;
}

export class DeepseekLLM implements IAgxntLLM {
    private tools: IAgxntTool[] = [];
    private toolHandlers: Map<string, ToolHandler> = new Map();
    private messages: Message[] = [];

    constructor(
        private model: string | null= null,
        private temperature: number | null = null,
        private toolChoice: "auto" | "none" | "required" | null  = null
    ){

    }

    bindTools(tools: IAgxntTool[]): DeepseekLLM {
        this.tools = tools;
        return this;
    }

    setMessages(messages: Array<{ role: string; content: string }>): DeepseekLLM {
        this.messages = messages.map(m => ({
            role: m.role as Message['role'],
            content: m.content
        }));
        return this
    }

    registerToolHandler(name: string, handler: ToolHandler): void {
        this.toolHandlers.set(name, handler);
    }

    private buildOptions(): {
        temperature?: number;
        model?: string;
        tool_choice?: "auto" | "none" | "required";
    } {
        return {
            temperature: this.temperature || undefined,
            model: this.model || undefined,
            tool_choice: this.toolChoice || undefined,
        };
    } 

    async send(onChunk?: (chunk: IChaxStreamChunk) => void): Promise<IAgxntLLMResponse> {
        if (this.messages.length === 0) {
            throw new Error("请先调用 setMessages 设置消息");
        }

        let accumulatedContent = "";
        let toolCallsMap = new Map<number, any>();
        let hasToolCalls = false;

        for await (const chunk of callDeepseekStream(this.messages, this.tools ,this.buildOptions())) {
            if (chunk.done) {
                break;
            }

            if (chunk.content) {
                accumulatedContent += chunk.content;
                onChunk?.({ type: 'chunk', content: chunk.content });
            }

            if (chunk.tool_calls) {
                hasToolCalls = true;
                for (const tc of chunk.tool_calls) {
                    const existing = toolCallsMap.get(tc.index) || { id: "", type: "function", function: { name: "", arguments: "" } };
                    if (tc.id) existing.id = tc.id;
                    if (tc.type) existing.type = tc.type;
                    if (tc.function) {
                        if (tc.function.name) existing.function.name += tc.function.name;
                        if (tc.function.arguments) existing.function.arguments += tc.function.arguments;
                    }
                    toolCallsMap.set(tc.index, existing);
                }
            }
        }

        const response: IAgxntLLMResponse = {
            content: accumulatedContent,
            tool_calls: toolCallsMap.size > 0 ? Array.from(toolCallsMap.values()) : undefined
        };

        if (hasToolCalls && toolCallsMap.size > 0) {
            this.messages.push({
                role: "assistant",
                content: accumulatedContent,
                tool_calls: Array.from(toolCallsMap.values())
            });
        }

        return response;
    }

    async steam(onChunk?: (chunk: IChaxStreamChunk) => void): Promise<{ content?: string }> {
        if (this.messages.length === 0) {
            throw new Error("请先调用 setMessages 设置消息");
        }

        while (true) {
            let accumulatedContent = "";
            let toolCallsMap = new Map<number, any>();
            let hasToolCalls = false;

            for await (const chunk of callDeepseekStream(this.messages, this.tools ,this.buildOptions())) {
                if (chunk.done) {
                    break;
                }

                if (chunk.content) {
                    accumulatedContent += chunk.content;
                    onChunk?.({ type: 'chunk', content: chunk.content });
                }

                if (chunk.tool_calls) {
                    hasToolCalls = true;
                    for (const tc of chunk.tool_calls) {
                        const existing = toolCallsMap.get(tc.index) || { id: "", type: "function", function: { name: "", arguments: "" } };
                        if (tc.id) existing.id = tc.id;
                        if (tc.type) existing.type = tc.type;
                        if (tc.function) {
                            if (tc.function.name) existing.function.name += tc.function.name;
                            if (tc.function.arguments) existing.function.arguments += tc.function.arguments;
                        }
                        toolCallsMap.set(tc.index, existing);
                    }
                }
            }

            if (hasToolCalls && toolCallsMap.size > 0) {
                const toolCalls = Array.from(toolCallsMap.values());

                this.messages.push({
                    role: "assistant",
                    content: accumulatedContent,
                    tool_calls: toolCalls
                });

                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function?.name;
                    let result: string;

                    const handler = this.toolHandlers.get(functionName);
                    if (handler) {
                        try {
                            const args = JSON.parse(toolCall.function?.arguments || '{}');
                            const handlerResult = handler(args);
                            result = typeof handlerResult === 'string' ? handlerResult : await handlerResult;
                        } catch (e) {
                            result = "参数解析错误";
                        }
                    } else {
                        result = `未知工具: ${functionName}`;
                    }

                    this.messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: result,
                    });

                    onChunk?.({ type: 'chunk', content: `\n[Tool Result] ${result}\n` });
                }

                continue;
            }

            if (accumulatedContent) {
                this.messages.push({
                    role: "assistant",
                    content: accumulatedContent
                });
            }

            return { content: accumulatedContent };
        }
    }
}

export function createDeepseekLLM(): DeepseekLLM {
    return new DeepseekLLM();
}
