// DeepSeek Chat API 工具调用示例（TypeScript 版，直接调用原生 API，不依赖第三方 SDK）
const API_KEY = "sk-5069284b93a7481db08a15f65628906a"; // 替换为你的 DeepSeek API Key（从 https://platform.deepseek.com/api-keys 获取）
const BASE_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat"; // 通用聊天模型（指向最新版本）

// 示例工具：获取天气（实际使用时可替换为真实 API 调用）
function getCurrentWeather(location: string): string {
    // 这里可以接入真实天气 API，示例直接返回模拟结果
    return `${location} 的当前天气：晴天，温度 25°C，湿度 50%.`;
}

const tool = {
    type: "function",
    function: {
        name: "get_current_weather",
        description: "获取指定城市的当前天气信息",
        parameters: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "城市名称，例如 '北京' 或 'Shanghai'"
                }
            },
            required: ["location"]
        }
    }
} 
type Tool = typeof tool;

import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { Readable } from "stream";

// 定义工具（DeepSeek 完全兼容 OpenAI 的 tools 格式）
const tools = [tool];


// 类型定义（基于 OpenAI/DeepSeek 的响应结构）
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
    tool_call_id?: string; // 用于 tool 角色消息
}

interface ChatResponse {
    choices: Array<{
        message: Message;
    }>;
}

// 流式块解析
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
    tool_choice?: any;
}

function parseSSEChunk(chunk: string): StreamChunk | null {
    console.log(chunk)
    const lines = chunk.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
                return { content: undefined };
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
                // 忽略解析错误
            }
        }
    }
    return null;
}

// 流式调用 DeepSeek API 的函数
async function* callDeepseekStream(
    messages: Message[],
    tools?: Tool[],
    tool_choice: "auto" | "none" | "required" = "auto"
): AsyncGenerator<StreamChunk> {
    const payload: any = {
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true, // 启用流式
    };

    if (tools) {
        payload.tools = tools;
        payload.tool_choice = tool_choice;
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

// 完整的流式工具调用循环（支持多轮工具调用和并行调用）
async function runToolAgent(userQuery: string): Promise<string> {
    let messages: Message[] = [
        { role: "user", content: userQuery }
    ];

    let accumulatedContent = "";
    let toolCallsMap = new Map<number, any>();
    let hasToolCalls = false;

    while (true) {
        accumulatedContent = "";
        toolCallsMap.clear();
        hasToolCalls = false;

        // 流式调用模型（带 tools）
        for await (const chunk of callDeepseekStream(messages, tools)) {
            if (chunk.content) {
                accumulatedContent += chunk.content;
            }

            if (chunk.tool_calls) {
                console.log()
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

        // 如果有工具调用，执行它们
        if (hasToolCalls && toolCallsMap.size > 0) {
            const toolCalls = Array.from(toolCallsMap.values());

            // 添加 assistant 消息（包含工具调用）
            messages.push({
                role: "assistant",
                content: accumulatedContent,
                tool_calls: toolCalls
            });

            // 执行每个工具调用
            for (const toolCall of toolCalls) {
                const functionName = toolCall.function?.name;
                let result: string;

                if (functionName === "get_current_weather") {
                    try {
                        const args = JSON.parse(toolCall.function?.arguments || '{}');
                        const location = args.location as string;
                        result = getCurrentWeather(location);
                    } catch (e) {
                        result = "参数解析错误";
                    }
                } else {
                    result = "未知工具";
                }

                // 添加 tool 角色消息
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result,
                });
            }

            // 继续下一轮调用
            continue;
        }

        // 没有工具调用，返回最终回答
        if (accumulatedContent) {
            messages.push({
                role: "assistant",
                content: accumulatedContent
            });
        }

        return accumulatedContent;
    }
}

// 使用示例
(async () => {
    try {
        const userInput = "北京今天的天气怎么样？";
        console.log("用户输入:", userInput);
        console.log("流式响应:");
        const finalAnswer = await runToolAgent(userInput);
        console.log("\n最终回答：");
        console.log(finalAnswer);
    } catch (error) {
        console.error("错误:", error);
    }
})();


export default runToolAgent;