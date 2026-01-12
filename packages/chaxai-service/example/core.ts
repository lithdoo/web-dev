import { ChatDeepSeek } from '@langchain/deepseek';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from 'koa2-cors';
import { CoreChaxKoaMiddleWare, IChaxCore } from '../src/CoreBuilder';
import { IMessage, IChaxStreamChunk } from '@chaxai-common';
import { Tool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { StateGraph, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { MessagesPlaceholder } from '@langchain/core/prompts';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ReadFileTool - 用于读取文件内容的工具类
 * 
 * 提供安全的文件读取功能，包括：
 * - 绝对路径解析
 * - 文件存在检查
 * - 文件类型限制（防止读取危险文件）
 */
class ReadFileTool extends Tool {
    name = 'read_file';
    description = '读取指定路径的文件内容。当你需要查看文件内容来回答问题时使用此工具。参数是文件路径字符串。';
    /**
     * 允许读取的文件扩展名列表
     */
    private allowedExtensions = [
        '.txt', '.js', '.ts', '.json', '.md', '.html', '.css',
        '.yaml', '.yml', '.xml', '.csv', '.log'
    ];

    /**
     * 执行文件读取操作
     * @param filePath 文件路径字符串
     * @returns 文件内容或错误信息
     */
    async _call(filePath: string): Promise<string> {
        try {
            console.log('ReadFileTool._call 输入参数:', filePath);

            if (!filePath) {
                return `错误：文件路径不能为空。`;
            }

            // 解析绝对路径
            const absolutePath = path.isAbsolute(filePath)
                ? filePath
                : path.join(process.cwd(), filePath);

            // 检查文件是否存在
            const stats = await fs.stat(absolutePath);
            if (!stats.isFile()) {
                return `错误：${filePath} 不是一个文件。`;
            }

            // 检查文件扩展名
            const ext = path.extname(absolutePath).toLowerCase();
            if (!this.allowedExtensions.includes(ext)) {
                return `错误：不允许读取 ${ext} 类型的文件。`;
            }

            // 读取文件内容
            const content = await fs.readFile(absolutePath, 'utf-8');
            return `文件 ${filePath} 的内容：\n\n${content}`;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return `错误：文件 ${filePath} 不存在。`;
            }
            return `错误：读取文件时发生错误 - ${(error as Error).message}`;
        }
    }
}

/**
 * CoreBuilder 聊天服务示例
 * 
 * 本示例展示了如何使用 CoreBuilder 的接口创建一个聊天服务：
 * 1. 实现 IChaxCore 接口
 * 2. 使用 CoreChaxKoaMiddleWare 创建中间件
 * 3. 启动 Koa 服务器提供聊天 API
 */

// DeepSeek API 密钥
// 注意：在生产环境中，应使用环境变量存储密钥
const DEEPSEEK_API_KEY = 'sk-5069284b93a7481db08a15f65628906a';

/**
 * 智能体状态结构
 */
interface AgentState {
    input: string;
    thinking: string;
    answer: string;
    chat_history: IMessage[];
    tool_calls?: ToolCall[];
    tool_result?: string;
}

/**
 * 工具调用结构
 */
interface ToolCall {
    id: string;
    name: string;
    params: Record<string, any>;
}

/**
 * 智能体核心组件
 * 
 * 提供创建智能体的功能，包含文件读取和网络搜索工具
 */
class AgentCore {
    private llm: ChatDeepSeek;
    private tools: Tool[];

    constructor(llm: ChatDeepSeek) {
        this.llm = llm;
        this.tools = [new ReadFileTool(), new DuckDuckGoSearch({ maxResults: 5 })];
    }

    /**
     * 创建智能体
     */
    createAgent(sendChunk?: (chunk: IChaxStreamChunk) => void) {
        // 使用Annotation定义状态结构
        const agentStateAnnotation = Annotation.Root({
            input: Annotation<string>(),
            thinking: Annotation<string>(),
            answer: Annotation<string>(),
            chat_history: Annotation<IMessage[]>(),
            tool_calls: Annotation<ToolCall[]>(),
            tool_result: Annotation<string | undefined>(),
        });

        // 创建思考节点的提示模板
        const thinkingPrompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                `你是一个智能助手，现在需要对用户的问题进行深度思考。
        请分析问题的要求，思考解决问题的步骤和方法。
        不要直接给出最终答案，只需要输出你的思考过程。
        思考过程应该结构化、逻辑清晰，使用自然语言表达。
        不要包含任何工具调用格式或JSON代码块。
        `
            ],
            new MessagesPlaceholder('chat_history'),
            ['human', '{input}'],
        ]);

        // 创建回答节点的提示模板
        const answerPrompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                '你是一个智能助手，具有读取文件和网络搜索的能力。\n' +
                '你可以使用以下工具来帮助回答问题：\n' +
                '1. read_file: 读取指定路径的文件内容，参数为filePath（文件路径字符串）\n' +
                '2. duckduckgo-search: 进行网络搜索，参数为query（搜索关键词字符串）\n' +
                '\n' +
                '请根据用户的问题、思考过程和工具结果，决定是否需要使用工具，以及如何使用工具。\n\n' +
                '重要要求：\n' +
                '1. 当用户要求查看文件内容时，你必须使用read_file工具\n' +
                '2. 当你需要获取最新的外部信息、实时数据或不知道答案时，你必须使用duckduckgo-search工具\n' +
                '3. 如果有工具结果（tool_result），请**务必结合工具结果**直接回答用户的问题，不要使用工具调用格式\n' +
                '4. 只有当没有工具结果时，你才需要使用工具调用格式\n' +
                '5. 工具调用格式必须是：\n' +
                '```json\n' +
                '{{"toolcall": {{"thought": "你的思考过程", "name": "工具名称", "params": {{"参数名": "参数值"}}}}}}\n' +
                '```\n\n' +
                '6. 工具调用必须包含在json代码块中\n' +
                '7. 工具名称必须是read_file或duckduckgo-search中的一个\n' +
                '8. 如果你已经通过工具获得了足够的信息来回答问题，请**直接给出答案**，不要再次调用工具\n' +
                '9. 对于时效性问题（如新闻事件、比赛时间、最新数据等），你必须使用duckduckgo-search工具获取最新信息\n' +
                '10. 工具调用的json代码块必须严格按照上述格式，不能包含任何额外内容'
            ],
            new MessagesPlaceholder('messages'),
        ]);

        // 创建思考节点
        const thinkingNode = async (state: AgentState) => {
            const thinkingChain = thinkingPrompt.pipe(this.llm);

            if (sendChunk) {
                // 流式调用LLM
                let thinkingContent = '';
                let firstChunk = true;
                const stream = await thinkingChain.stream({
                    input: state.input,
                    chat_history: state.chat_history.map(msg => {
                        switch (msg.role) {
                            case 'user':
                                return new HumanMessage(msg.content);
                            case 'assistant':
                                return new AIMessage(msg.content);
                            case 'system':
                                return new SystemMessage(msg.content);
                            default:
                                return new HumanMessage(msg.content);
                        }
                    })
                });

                // 处理流数据
                for await (const chunk of stream) {
                    let chunkContent = '';
                    
                    // 安全地获取chunk内容 - 增加与回答节点相同的严格检查
                    if (chunk != null) {
                        if (typeof chunk === 'object' && 'content' in chunk && chunk.content != null) {
                            chunkContent = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
                        } else if (typeof chunk === 'string') {
                            // 处理可能的字符串chunk
                            chunkContent = chunk;
                        }
                        // 其他类型的chunk忽略，保持chunkContent为空字符串
                    }
                    
                    thinkingContent += chunkContent;

                    if (chunkContent) {
                        if (firstChunk) {
                            // 第一次发送时包含完整的格式
                            sendChunk({
                                type: 'chunk',
                                content: `\n\`\`\`lang=thinking\n${chunkContent}`
                            });
                            firstChunk = false;
                        } else {
                            // 后续只发送新增的内容部分
                            sendChunk({
                                type: 'chunk',
                                content: chunkContent
                            });
                        }
                    }
                }

                if (!firstChunk) {
                    // 发送结束标记
                    sendChunk({
                        type: 'chunk',
                        content: '\n\`\`\`\n'
                    });
                }


                return {
                    thinking: `\`\`\`lang=thinking\n${thinkingContent}\n\`\`\``
                } as any;
            } else {
                // 非流式调用LLM（兼容旧代码）
                const result = await thinkingChain.invoke({
                    input: state.input,
                    chat_history: state.chat_history.map(msg => {
                        switch (msg.role) {
                            case 'user':
                                return new HumanMessage(msg.content);
                            case 'assistant':
                                return new AIMessage(msg.content);
                            case 'system':
                                return new SystemMessage(msg.content);
                            default:
                                return new HumanMessage(msg.content);
                        }
                    })
                });
                const resultContent = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
                return {
                    thinking: `\`\`\`lang=thinking\n${resultContent}\n\`\`\``
                } as any;
            }
        };

        // 创建回答节点
        const respondNode = async (state: AgentState) => {
            // 创建一个能够使用工具的智能体
            const agent = createReactAgent({
                llm: this.llm,
                tools: this.tools,
                prompt: answerPrompt
            });
            
            if (sendChunk) {
                // 流式调用智能体生成回答
                let answerContent = '';
                let isToolCall = false;
                let inToolCall = false;
                let toolCallJsonStart = -1;
                
                // 转换对话历史从DeepSeekMessage格式到LangChain消息格式
                const chatHistoryMessages = state.chat_history.map(msg => {
                    switch (msg.role) {
                        case 'user':
                            return new HumanMessage(msg.content);
                        case 'assistant':
                            return new AIMessage(msg.content);
                        case 'system':
                            return new SystemMessage(msg.content);
                        default:
                            return new HumanMessage(msg.content);
                    }
                });
                
                // 构建完整的消息数组
                const messages = [
                    ...chatHistoryMessages,
                    new HumanMessage(state.input),
                    new AIMessage(`思考过程：\n${state.thinking}`),
                    ...(state.tool_result ? [new SystemMessage(`工具结果：\n${state.tool_result}`)] : [])
                ];
                
                const stream = await agent.stream({ messages });

                
                // 处理流数据
                for await (const chunk of stream) {
                    let chunkContent = '';
                    
                    // 安全地获取chunk内容 - 增加更严格的检查
                    if (chunk != null) {
                        if (typeof chunk === 'object' && 'content' in chunk && chunk.content != null) {
                            chunkContent = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
                        } else if (typeof chunk === 'string') {
                            // 处理可能的字符串chunk
                            chunkContent = chunk;
                        }
                        // 其他类型的chunk忽略，保持chunkContent为空字符串
                    }
                    
                    const currentPosition = answerContent.length;
                    answerContent += chunkContent;
                    
                    // 调试日志：输出每个流块
                    console.log('回答节点流块内容:', JSON.stringify(chunkContent));
                    
                    if (inToolCall && chunkContent !== undefined && chunkContent !== null) {
                        // 在工具调用内部，继续收集内容直到找到结束标记
                        const toolCallEndIndex = chunkContent.indexOf('```');
                        if (toolCallEndIndex !== -1) {
                            // 工具调用结束，标记为已完成
                            inToolCall = false;
                            console.log('检测到工具调用结束标记');
                        }
                    } else if (chunkContent !== undefined && chunkContent !== null) {
                        // 不在工具调用内部，检查是否有工具调用开始标记        
                        const toolCallStartIndex = chunkContent.indexOf('```json');
                        if (toolCallStartIndex !== -1) {
                            // 找到工具调用开始标记
                            inToolCall = true;
                            isToolCall = true;
                            toolCallJsonStart = currentPosition + toolCallStartIndex;
                            console.log('检测到工具调用开始标记');
                            
                            // 如果标记前有内容，发送这部分内容
                            if (toolCallStartIndex > 0) {
                                sendChunk({
                                    type: 'chunk',
                                    content: chunkContent.substring(0, toolCallStartIndex)
                                });
                            }
                        } else {
                            // 没有工具调用标记，直接发送内容
                            sendChunk({
                                type: 'chunk',
                                content: chunkContent
                            });
                        }
                    }
                }
                
                // 如果是工具调用，返回工具调用信息
                if (isToolCall && toolCallJsonStart !== -1) {
                    const toolCallMatch = answerContent.match(/\`\`\`json\s*({[\s\S]*?})\s*\`\`\`/);
                    if (toolCallMatch) {
                        try {
                            const toolCallJson = JSON.parse(toolCallMatch[1]);
                            const toolCall = toolCallJson.toolcall;

                            console.log('检测到工具调用：', JSON.stringify(toolCall, null, 2));

                            // 确保工具调用格式正确
                            if (toolCall && toolCall.name && toolCall.params) {
                                return {
                                    tool_calls: [{
                                        id: "tool_call_1",
                                        name: toolCall.name,
                                        params: toolCall.params
                                    }]
                                } as any;
                            } else {
                                console.error('工具调用格式不正确：', toolCall);
                                // 如果工具调用格式不正确，清理内容并发送
                                const cleanContent = answerContent.replace(/\`\`\`json[\s\S]*?\`\`\`/g, '').trim();
                                return { answer: cleanContent || "已完成任务" } as any;
                            }
                        } catch (e) {
                            console.error('解析工具调用失败：', e);
                            // 如果解析失败，清理内容并发送
                            const cleanContent = answerContent.replace(/\`\`\`json[\s\S]*?\`\`\`/g, '').trim();
                            return { answer: cleanContent || "已完成任务" } as any;
                        }
                    }
                }
                
                // 如果有工具结果，确保回答内容已经发送
                if (state.tool_result) {
                    // 清理可能包含的工具调用格式
                    const finalAnswer = answerContent.replace(/\`\`\`json[\s\S]*?\`\`\`/g, '').trim();
                    // 内容应该已经通过流式发送了，这里只需要返回状态
                    return { answer: finalAnswer || "已完成任务" } as any;
                }
                
                // 如果没有工具调用，所有内容都应该已经通过流式发送了
                return { answer: answerContent } as any;
            } else {
                // 转换对话历史从DeepSeekMessage格式到LangChain消息格式
                const chatHistoryMessages = state.chat_history.map(msg => {
                    switch (msg.role) {
                        case 'user':
                            return new HumanMessage(msg.content);
                        case 'assistant':
                            return new AIMessage(msg.content);
                        case 'system':
                            return new SystemMessage(msg.content);
                        default:
                            return new HumanMessage(msg.content);
                    }
                });
                
                // 构建完整的消息数组
                const messages = [
                    ...chatHistoryMessages,
                    new HumanMessage(state.input),
                    new AIMessage(`思考过程：\n${state.thinking}`),
                    ...(state.tool_result ? [new SystemMessage(`工具结果：\n${state.tool_result}`)] : [])
                ];
                
                // 非流式调用智能体
                const result = await agent.invoke({ messages });

                // 从messages数组获取最后一条消息的内容
                const lastMessage = result.messages[result.messages.length - 1];
                const contentAsString = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

                // 如果有工具结果，直接返回最终答案，不再检查工具调用
                if (state.tool_result) {
                    // 清理可能包含工具调用格式的回答
                    const finalAnswer = contentAsString.replace(/\`\`\`json[\s\S]*?\`\`\`/g, '').trim();
                    return { answer: finalAnswer || "已完成任务" } as any;
                }

                // 检查是否需要调用工具
                const toolCallMatch = contentAsString.match(/\`\`\`json\s*({[\s\S]*?})\s*\`\`\`/);
                if (toolCallMatch) {
                    try {
                        const toolCallJson = JSON.parse(toolCallMatch[1]);
                        const toolCall = toolCallJson.toolcall;

                        console.log('检测到工具调用：', JSON.stringify(toolCall, null, 2));

                        // 确保工具调用格式正确
                        if (toolCall && toolCall.name && toolCall.params) {
                            return {
                                tool_calls: [{
                                    id: "tool_call_1",
                                    name: toolCall.name,
                                    params: toolCall.params
                                }]
                            } as any;
                        } else {
                            console.error('工具调用格式不正确：', toolCall);
                            return { answer: contentAsString } as any;
                        }
                    } catch (e) {
                        console.error('解析工具调用失败：', e);
                        return { answer: contentAsString } as any;
                    }
                }

                return { answer: contentAsString } as any;
            }
        };

        // 创建工具调用节点
        const toolCallNode = async (state: AgentState) => {
            if (!state.tool_calls || state.tool_calls.length === 0) {
                return {
                    tool_result: "没有需要调用的工具",
                    tool_calls: [] as ToolCall[]
                } as any;
            }

            console.log('执行工具调用节点');
            const toolCall = state.tool_calls[0];
            const tool = this.tools.find(t => t.name === toolCall.name);

            if (!tool) {
                return {
                    tool_result: `工具 ${toolCall.name} 不存在`,
                    tool_calls: [] as ToolCall[]  // 清除工具调用列表
                } as any;
            }

            try {
                console.log('当前工作目录：', process.cwd());
                console.log('工具名称：', toolCall.name);
                console.log('原始参数：', JSON.stringify(toolCall.params, null, 2));

                // 处理不同工具的调用方式
                let result;

                if (toolCall.name === 'read_file') {
                    // read_file工具需要直接传递文件路径字符串
                    const filePath = toolCall.params.filePath || toolCall.params.path;
                    console.log('直接传递文件路径：', filePath);
                    result = await tool.invoke(filePath);
                } else if (toolCall.name === 'duckduckgo-search') {
                    // duckduckgo-search工具需要直接传递查询字符串
                    const query = toolCall.params.query;
                    console.log('直接传递查询字符串：', query);

                    // 检查查询参数是否存在且不为空
                    if (!query || query.trim() === '') {
                        throw new Error('搜索查询不能为空');
                    }

                    // 使用invoke方法直接传递字符串
                    result = await tool.invoke(query);
                } else {
                    // 其他工具传递参数对象
                    result = await tool.invoke(toolCall.params);
                }
                console.log('工具调用结果：', result);

                return {
                    tool_result: result,
                    tool_calls: [] as ToolCall[]  // 清除工具调用列表
                } as any;
            } catch (error) {
                console.error('调用工具失败：', error);
                return {
                    tool_result: `调用工具 ${toolCall.name} 时发生错误：${(error as Error).message}`,
                    tool_calls: [] as ToolCall[]  // 清除工具调用列表
                } as any;
            }
        };

        // 创建状态图
        const graph = new StateGraph(agentStateAnnotation)
            .addNode("think", thinkingNode)
            .addNode("respond", respondNode)
            .addNode("call_tool", toolCallNode)
            .addEdge("think", "respond")
            .addConditionalEdges(
                "respond",
                (state: AgentState) => {
                    return state.tool_calls && state.tool_calls.length > 0 ? "call_tool" : END;
                }
            )
            .addEdge("call_tool", "respond")
            .setEntryPoint("think");

        // 编译图
        return graph.compile();
    }

    /**
     * 获取所有工具
     */
    getTools() {
        return this.tools;
    }
}

/**
 * 实现 IChaxCore 接口的聊天服务类
 */
class ChatCore implements IChaxCore {

    /**
     * 处理聊天请求
     * @param llm ChatDeepSeek 实例
     * @param history 历史消息数组
     * @param sendChunk 发送流式响应的回调函数
     */
    onChat(
        llm: ChatDeepSeek,
        history: IMessage[],
        sendChunk: (chunk: IChaxStreamChunk) => void
    ): void {
        console.log('=== onChat 方法被调用 ===');
        console.log('历史消息数量:', history.length);
        console.log('历史消息:', JSON.stringify(history, null, 2));
        console.log('最后一条消息:', history[history.length - 1]);

        // 发送开始消息
        sendChunk({
            type: 'init',
            content: Date.now().toString()
        });

        // 创建 AgentCore 实例
        const agentCore = new AgentCore(llm);

        // 创建智能体，并传递 sendChunk 回调
        const agent = agentCore.createAgent(sendChunk);

        // 获取最后一条用户消息作为当前输入
        const lastMessage = history[history.length - 1];
        const currentInput = lastMessage?.role === 'user' ? lastMessage.content : '';

        console.log('正在处理智能体响应...');
        console.log('当前输入:', currentInput);
        console.log('历史消息:', JSON.stringify(history.slice(0, -1), null, 2));
        // 处理智能体响应
        this.handleAgentResponse(agent, history, currentInput, sendChunk);
    }

    /**
     * 处理智能体响应
     * @param agent 智能体实例
     * @param history 历史消息数组
     * @param input 当前用户输入
     * @param sendChunk 发送流式响应的回调函数
     */
    private async handleAgentResponse(
        agent: any,
        history: IMessage[],
        input: string,
        sendChunk: (chunk: IChaxStreamChunk) => void
    ): Promise<void> {
        try {
            // 设置初始状态
            const initialState: AgentState = {
                input,
                thinking: '',
                answer: '',
                chat_history: history.slice(0, -1) || [] // 不包含当前用户输入，但保留所有之前的对话历史
            };

            // 执行智能体
            const result = await agent.invoke(initialState);

            console.log('智能体执行结果:', JSON.stringify(result, null, 2));

            // 思考过程和回答已经通过流式方式实时发送，这里不再重复发送

            // 发送结束消息
            sendChunk({
                type: 'done',
                content: ''
            });
        } catch (error) {
            console.error('智能体执行过程中发生错误:', error);
            sendChunk({
                type: 'error',
                content: `发生错误: ${(error as Error).message}`
            });
        }
    }
}

/**
 * 初始化 DeepSeek 聊天模型
 */
function initializeDeepSeek() {
    return new ChatDeepSeek({
        model: 'deepseek-chat',
        apiKey: DEEPSEEK_API_KEY,
        temperature: 0.7,
        maxTokens: 1024,
    });
}

/**
 * 启动聊天服务
 */
async function startServer() {
    console.log('=== 启动 CoreBuilder 聊天服务 ===');

    // 创建 Koa 应用实例
    const app = new Koa();

    // 使用 cors 中间件启用跨域访问
    app.use(cors());

    // 使用 bodyParser 中间件解析请求体
    app.use(bodyParser());

    // 设置服务端口
    const port = 3000;

    // 创建 ChatCore 实例
    const chatCore = new ChatCore();

    // 初始化 DeepSeek 模型
    const llm = initializeDeepSeek();

    // 创建并使用 CoreChaxKoaMiddleWare
    const middleware = new CoreChaxKoaMiddleWare(
        chatCore,
        () => llm // 传入 LLM 工厂函数
    );

    // 将中间件添加到 Koa 应用
    app.use(middleware.createMiddleware());

    // 启动服务
    app.listen(port, () => {
        console.log(`CoreBuilder 聊天服务已启动，监听端口 ${port}`);
        console.log('API 端点:');
        console.log('- GET /ai/record/list - 获取会话列表');
        console.log('- GET /ai/message/list/{recordId} - 获取会话消息');
        console.log('- POST /ai/chat - 发送消息');
        console.log('- GET /ai/message/content/{msgId} - 获取消息内容');
        console.log('- GET /ai/message/stream/{msgId} - 流式获取消息');
        console.log('');
        console.log('服务已准备就绪，可以开始对话！');
        console.log('='.repeat(50));
    });
}

/**
 * 运行示例
 */
async function runExample() {
    console.log('CoreBuilder 聊天服务示例');
    console.log('='.repeat(50));

    // 检查是否设置了 API 密钥
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.trim() === '') {
        console.error('错误：请在文件中设置您的 DeepSeek API 密钥');
        process.exit(1);
    }

    // 启动服务器
    await startServer();
}

// 执行示例
console.log('=== 执行示例 ===');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);
console.log('条件检查结果:', import.meta.url === `file://${process.argv[1]}`);

// 直接调用 runExample，不进行条件检查
runExample().catch(error => {
    console.error('运行示例时出错:', error);
    process.exit(1);
});

// 导出函数供其他模块使用
export {
    ChatCore,
    ReadFileTool,
    AgentCore,
    initializeDeepSeek,
    startServer
};
