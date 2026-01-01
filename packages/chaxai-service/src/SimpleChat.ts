import { type IChaxHistroyService, type IChaxConversation, type IChaxMessage, type IChaxStreamChunk, type IChaxConversationManager, type IChaxConversationManagerBuilder } from "@chaxai-common";
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { ChaxKoaMiddleWare } from "./KoaMiddleWare";
import { ChaxFileService } from "./FileService";

/**
 * SimpleChat - 基于 LangChain 和 DeepSeek 的简单聊天管理器构建器
 * 
 * 使用建造者模式创建 SimpleChatManager 实例，负责配置和组装聊天服务组件。
 * 
 * 架构层次:
 * - SimpleChat: 建造者类，负责创建聊天管理器
 * - SimpleChatManager: 实际的管理器实现，处理会话逻辑
 * - SimpleChatKoaMiddleWare: Koa 中间件，集成到 HTTP 服务
 */
export class SimpleChat implements IChaxConversationManagerBuilder {
    
    /**
     * 构建一个 SimpleChatManager 实例
     * 
     * @param history 历史消息服务，用于存储和检索对话记录
     * @returns 配置好的会话管理器实例
     */
    build(history: IChaxHistroyService): IChaxConversationManager {
        return new SimpleChatManager(history);
    }
}

/**
 * SimpleChatManager - 简单的聊天会话管理器
 * 
 * 负责管理对话生命周期，包括创建会话和继续对话。
 * 使用 DeepSeek API 通过 LangChain 进行流式对话生成。
 * 
 * 工作流程:
 * 1. onCreateConversation: 创建新的会话，生成唯一 ID
 * 2. onContinueConversation: 继续现有会话，调用 AI 生成响应
 * 3. processConversation: 内部方法，处理消息历史和 AI 流式响应
 */
export class SimpleChatManager implements IChaxConversationManager {
    
    /**
     * 历史消息服务
     * 用于获取和存储对话历史记录
     */
    private history: IChaxHistroyService;
    
    /**
     * DeepSeek 聊天模型实例
     * 使用 LangChain 提供的 DeepSeek 集成
     */
    private deepseek: ChatDeepSeek;

    /**
     * 构造函数
     * 
     * @param history 历史消息服务实例
     */
    constructor(history: IChaxHistroyService) {
        this.history = history;
        this.deepseek = new ChatDeepSeek({
            model: 'deepseek-chat',
            apiKey: process.env.DEEPSEEK_API_KEY,
            temperature: 0.7,
        });
    }

    /**
     * 创建新会话
     * 
     * 生成新的会话 ID，初始化会话元数据（创建时间、更新时间、标题）。
     * 注意：此方法仅创建会话元数据，不存储用户消息。
     * 用户消息由 FileService.onSendChatMessage 负责存储。
     * 
     * @param message 用户发送的初始消息
     * @returns 包含会话信息的对象
     * @throws 如果消息为空或仅包含空白字符
     */
    async onCreateConversation(message: string): Promise<IChaxConversation> {
        if (!message || message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }
        
        const conversationId = uuidv4();
        const conversation: IChaxConversation = {
            conversationId,
            createTimestamp: Date.now(),
            updateTimestamp: Date.now(),
            title: message.slice(0, 50),
        };
        
        return conversation;
    }

    /**
     * 继续会话
     * 
     * 根据会话 ID 获取对话历史，调用 DeepSeek API 生成流式响应。
     * 此方法立即返回，通过 onChunk 回调异步发送流式数据。
     * 
     * 回调类型说明:
     * - init: 初始化，发送 AI 消息 ID
     * - chunk: 流式数据块，发送 AI 生成的文本片段
     * - done: 完成，发送完整的 AI 响应内容
     * - error: 错误，发送错误信息
     * 
     * @param conversationId 会话 ID
     * @param onChunk 流式响应回调函数
     */
    onContinueConversation(conversationId: string, onChunk: (chunk: IChaxStreamChunk) => void): void {
        this.processConversation(conversationId, onChunk).catch(error => {
            onChunk({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        });
    }

    /**
     * 处理对话的核心方法
     * 
     * 执行以下步骤:
     * 1. 从历史服务获取会话消息列表
     * 2. 将消息转换为 LangChain 格式
     * 3. 调用 DeepSeek API 获取流式响应
     * 4. 通过回调函数发送响应数据
     * 
     * @param conversationId 会话 ID
     * @param onChunk 流式响应回调函数
     */
    private async processConversation(conversationId: string, onChunk: (chunk: IChaxStreamChunk) => void): Promise<void> {
        let messages: IChaxMessage[];
        
        try {
            messages = await this.history.onFetchChatMessages(conversationId);
        } catch (error) {
            onChunk({
                type: 'error',
                content: error instanceof Error ? error.message : 'Failed to fetch conversation history'
            });
            return;
        }

        const conversationMessages: ChatMessage[] = await Promise.all(
            messages
                .filter((msg: IChaxMessage) => msg.visiableInClient)
                .map(async (msg: IChaxMessage) => {
                    let content: string;
                    try {
                        const result = await this.history.onFetchContentMessage(msg.msgId);
                        content = result.content ? result.content : `生成失败: ${result.error || 'Unknown error'}`;
                    } catch (error) {
                        content = `生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    }
                    return new ChatMessage(content, msg.role as 'user' | 'assistant' | 'system');
                })
        );

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage) {
            onChunk({ type: 'error', content: 'No messages in conversation' });
            return;
        }

        let userMessage: string;
        try {
            const result = await this.history.onFetchContentMessage(lastMessage.msgId);
            userMessage = result.content || '';
        } catch (error) {
            userMessage = '';
        }
        
        conversationMessages.push(new ChatMessage(userMessage || '', 'user'));

        const aiMsgId = uuidv4();

        onChunk({
            type: 'init',
            content: aiMsgId
        });

        const stream = await this.deepseek.stream(conversationMessages);

        let fullContent = '';
        for await (const chunk of stream) {
            const text = typeof chunk === 'string' ? chunk : '';
            fullContent += text;
            onChunk({
                type: 'chunk',
                content: text
            });
        }

        onChunk({
            type: 'done',
            content: fullContent
        });
    }
}

/**
 * SimpleChatKoaMiddleWare - SimpleChat 的 Koa 中间件封装
 * 
 * 提供便捷的 Koa 集成方式，自动配置完整的聊天服务。
 * 继承 ChaxKoaMiddleWare，提供所有标准 API 端点。
 * 
 * API 端点:
 * - GET /ai/record/list - 获取会话列表
 * - GET /ai/message/list/{recordId} - 获取会话消息
 * - POST /ai/chat - 发送消息
 * - GET /ai/message/content/{msgId} - 获取消息内容
 * - GET /ai/message/stream/{msgId} - 流式获取消息
 * 
 * 使用示例:
 * ```typescript
 * const app = new Koa();
 * app.use(new SimpleChatKoaMiddleWare(dirPath).createMiddleware());
 * ```
 */
export class SimpleChatKoaMiddleWare extends ChaxKoaMiddleWare {
    
    /**
     * 构造函数
     * 
     * @param dirPath 数据存储目录路径，默认为环境变量 CHAXAI_FILE_DIR 或当前工作目录下的 .chaxai_data
     */
    constructor(dirPath?: string) {
        super(
            ChaxFileService.build(new SimpleChat(), dirPath)
        );
    }
}
