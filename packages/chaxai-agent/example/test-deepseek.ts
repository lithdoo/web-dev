import { createDeepseekLLM } from "../src/deepseek";
import { IAgxntTool } from "../src/interface";

const weatherTool: IAgxntTool = {
    info: {
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
    },
    call: async (args: Record<string, any>) => {
        return getCurrentWeather(args.location);
    }
};

function getCurrentWeather(location: string): string {
    return `${location} 的当前天气：晴天，温度 25°C，湿度 50%.`;
}

(async () => {
    try {
        const llm = createDeepseekLLM();
        llm.bindTools([weatherTool]);
        llm.registerToolHandler("get_current_weather", (args) => {
            return getCurrentWeather(args.location);
        });

        llm.setMessages([
            { role: "user", content: "北京今天的天气怎么样？" }
        ]);

        console.log("=== 测试 send 方法 ===");
        const response = await llm.send((chunk) => {
            if (chunk.type === 'chunk') {
                process.stdout.write(chunk.content);
            }
        });
        console.log("\n响应:", response);

        console.log("\n=== 测试 steam 方法 ===");
        llm.setMessages([
            { role: "user", content: "上海今天的天气怎么样？" }
        ]);
        const result = await llm.steam((chunk) => {
            if (chunk.type === 'chunk') {
                process.stdout.write(chunk.content);
            }
        });
        console.log("\n最终结果:", result);

    } catch (error) {
        console.error("错误:", error);
    }
})();
