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

// 调用 DeepSeek API 的函数
async function callDeepseek(
    messages: Message[],
    tools?: Tool[],
    tool_choice: "auto" | "none" | "required" = "auto"
): Promise<ChatResponse> {
    const payload: any = {
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
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

    return response.json() as Promise<ChatResponse>;
}

// 完整的工具调用循环（支持多轮工具调用和并行调用）
async function runToolAgent(userQuery: string): Promise<string> {
    let messages: Message[] = [
        { role: "user", content: userQuery }
    ];

    while (true) {
        // 第一步：调用模型（带 tools）
        const resp = await callDeepseek(messages, tools);

        const assistantMessage = resp.choices[0].message;
        console.log("assistantMessage:", assistantMessage);
        messages.push(assistantMessage);

        // 检查是否有工具调用
        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            // 没有工具调用，直接返回最终回答
            return assistantMessage.content || "";
        }

        // 有工具调用：逐个执行并将结果反馈
        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            let result: string;

            if (functionName === "get_current_weather") {
                const location = args.location as string;
                result = getCurrentWeather(location);
            } else {
                result = "未知工具";
            }

            // 添加 tool 角色消息（DeepSeek 兼容 OpenAI 格式）
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
            });
        }

        // 继续下一轮调用（模型会根据工具结果生成最终回答）
    }
}

// 使用示例
(async () => {
    try {
        const userInput = "北京今天的天气怎么样？";
        const finalAnswer = await runToolAgent(userInput);
        console.log("最终回答：");
        console.log(finalAnswer);
    } catch (error) {
        console.error("错误:", error);
    }
})();

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