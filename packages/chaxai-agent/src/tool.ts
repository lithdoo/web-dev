import { IAgxntTool } from "./interface";
import { readFileSync } from "fs";

interface LangChainTool {
    name: string;
    description: string;
    parameters?: Record<string, any>;
    _call(input: string | Record<string, any>): Promise<string>;
}

export function convertLangChainToolToIAgxntTool(tool: LangChainTool): IAgxntTool {
    return {
        info: {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        },
        call: async (args: Record<string, any>) => {
            return tool._call(args);
        }
    };
}

export function webSearchTool(): IAgxntTool {
    return {
        info: {
            type: "function",
            function: {
                name: "web_search",
                description: "搜索网络获取最新信息。当需要查找实时数据、新闻、天气预报或其他时效性信息时使用此工具。",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "搜索关键词"
                        }
                    },
                    required: ["query"]
                }
            }
        },
        call: async (args: Record<string, any>) => {
            const query = args.query;
            if (!query) {
                return "错误：缺少搜索关键词 query 参数";
            }

            try {
                const response = await fetch(
                    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
                );
                const text = await response.text();
                const match = text.match(/<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/);
                return match ? match[1] : "未找到搜索结果";
            } catch (error) {
                return `搜索失败: ${error}`;
            }
        }
    };
}

export const readFileTool: IAgxntTool = {
    info: {
        type: "function",
        function: {
            name: "read_file",
            description: "读取指定文件的文本内容",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "文件的绝对路径，例如 'C:/Users/test/document.txt'"
                    }
                },
                required: ["path"]
            }
        }
    },
    call: async (args: Record<string, any>) => {
        return readFile(args.path);
    }
};

export function readFile(path: string): string {
    try {
        const content = readFileSync(path, "utf-8");
        return content;
    } catch (error) {
        return `读取文件失败: ${error}`;
    }
}
