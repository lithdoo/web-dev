import { IChaxService, IChaxConversation, IChaxMessage, IChaxStreamChunk, IChaxConversationManagerBuilder } from "@chaxai-common";
import path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from 'uuid';

/**
 * ChaxFileService - 基于文件系统的聊天服务实现
 * 
 * 数据存储结构:
 * .chaxai_data/
 * ├── conversations/
 * │   ├── list.json          # 会话列表
 * │   └── {conversationId}.json  # 会话消息列表
 * └── messages/
 *     ├── {msgId}.txt        # 消息内容
 *     └── {msgId}.error.txt  # 错误信息
 * 
 * 发布-订阅模式:
 * - onSendChatMessage: 发布者，触发 AI 流式响应
 * - onFetchStreamMessage: 订阅者，注册监听回调
 * - respondChunkCallMap: 消息中心，存储 msgId -> 回调函数列表 的映射
 */

export abstract class ChaxFileService implements IChaxService {

    static build(conversationManagerBuilder: IChaxConversationManagerBuilder, dirPath: string = process.env.CHAXAI_FILE_DIR || path.join(process.cwd(), './.chaxai_data')) {
        return new class extends ChaxFileService {
            conversationManager = conversationManagerBuilder.build(this);
            constructor() {
                super(dirPath);
            }
            /**
             * 创建新会话
             * @param msg 初始消息内容
             * @returns 新会话对象
             */
            onCreateConversation(msg: string): Promise<IChaxConversation> {
                return this.conversationManager.onCreateConversation(msg);
            }
            /**
             * 继续会话
             * @param conversationId 会话ID
             * @param onChunk 流式响应回调函数
             */
            onContinueConversation(conversationId: string, onChunk: (chunk: IChaxStreamChunk) => void): void {
                this.conversationManager.onContinueConversation(conversationId, onChunk);
            }
        }
    }

    constructor(
        public readonly dirPath: string = process.env.CHAXAI_FILE_DIR || path.join(process.cwd(), './.chaxai_data'),
    ) {
    }


    /**
     * 获取会话根目录路径
     * @returns 会话目录的绝对路径
     */
    getConversationRootPath() {
        return path.join(this.dirPath, './conversations');
    }
    /**
     * 获取消息根目录路径
     * @returns 消息目录的绝对路径
     */
    getMessageRootPath() {
        return path.join(this.dirPath, './messages');
    }

    /**
     * 获取指定会话的目录路径
     * @param conversationId 会话ID
     * @returns 会话目录的绝对路径
     */
    getConversationPath(conversationId: string) {
        return path.join(this.getConversationRootPath(), conversationId);
    }

    /**
     * 获取会话列表 JSON 文件路径
     * @returns list.json 文件的绝对路径
     */
    getConversationListJsonPath() {
        return path.join(this.getConversationRootPath(), 'list.json');
    }

    /**
     * 获取指定会话的消息列表 JSON 文件路径
     * @param conversationId 会话ID
     * @returns {conversationId}.json 文件的绝对路径
     */
    getConversationMessageListJsonPath(conversationId: string) {
        return path.join(this.getConversationRootPath(), `${conversationId}.json`);
    }

    /**
     * 获取指定消息的内容文件路径
     * @param msgId 消息ID
     * @returns {msgId}.txt 文件的绝对路径
     */
    getMessageContentPath(msgId: string) {
        return path.join(this.getMessageRootPath(), `${msgId}.txt`);
    }

    /**
     * 获取指定消息的错误信息文件路径
     * @param msgId 消息ID
     * @returns {msgId}.error.txt 文件的绝对路径
     */
    getMessageErrorPath(msgId: string) {
        return path.join(this.getMessageRootPath(), `${msgId}.error.txt`);
    }


    /**
     * 获取所有会话列表
     * @returns 会话列表
     */
    async onFetchChatConversations(): Promise<IChaxConversation[]> {
        const listPath = this.getConversationListJsonPath();
        try {
            const content = fs.readFileSync(listPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    /**
     * 获取指定会话的消息列表
     * @param conversationId 会话ID
     * @returns 消息列表
     */
    async onFetchChatMessages(conversationId: string): Promise<IChaxMessage[]> {
        const messageListPath = this.getConversationMessageListJsonPath(conversationId);
        try {
            const content = fs.readFileSync(messageListPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    /**
     * 获取指定消息的完整内容（内容和错误信息）
     * 
     * 如果消息内容文件或错误文件存在，返回对应内容；
     * 如果都不存在，返回错误信息。
     * 
     * @param msgId 消息ID
     * @returns 包含 content 和 error 的对象
     */
    async onFetchContentMessage(msgId: string): Promise<{ content: string, error: string }> {
        const contentPath = this.getMessageContentPath(msgId);
        const errorPath = this.getMessageErrorPath(msgId);

        let content = '';
        let error = '';

        try {
            content = fs.readFileSync(contentPath, 'utf-8');
        } catch (err) {
            // console.warn(`Failed to read content file for message ${msgId}: ${err}`);
        }

        try {
            error = fs.readFileSync(errorPath, 'utf-8');
        } catch (err) {
            // console.warn(`Failed to read error file for message ${msgId}: ${err}`);
        }

        if (content || error) {
            return { content, error: error };
        }
        return { content: '', error: `Failed to read content or error file for message ${msgId}` };
    }



    /**
     * 创建新会话（抽象方法，由子类实现）
     * @param message 用户发送的第一条消息
     * @returns 创建的会话对象
     */
    abstract onCreateConversation(message: string): Promise<IChaxConversation>;

    /**
     * 继续会话并触发 AI 流式响应（抽象方法，由子类实现）
     * 
     * 该方法用于调用实际的 AI API，并在收到流式响应时通过 onChunk 回调通知。
     * 方法应同步调用 onChunk 多次（init/chunk/error/done），然后立即返回。
     * 
     * @param message 用户发送的消息
     * @param conversationId 会话ID
     * @param onChunk 流式响应的回调函数，会被多次调用
     */
    abstract onContinueConversation(conversationId: string, onChunk: (chunk: IChaxStreamChunk) => void): void;

    /**
     * 根据会话ID获取会话对象
     * @param conversationId 会话ID
     * @returns 会话对象
     * @throws 如果会话不存在或读取失败
     */
    getConversation(conversationId: string) {
        const listPath = this.getConversationListJsonPath();
        try {
            // 确保目录存在
            try {
                fs.accessSync(this.getConversationRootPath());
            } catch {
                fs.mkdirSync(this.getConversationRootPath(), { recursive: true });
            }

            // 确保list.json存在
            try {
                fs.accessSync(listPath);
            } catch {
                fs.writeFileSync(listPath, '[]', 'utf-8');
            }

            const content = fs.readFileSync(listPath, 'utf-8');
            const conversations = JSON.parse(content);
            return conversations.find((conv: IChaxConversation) => conv.conversationId === conversationId);
        } catch (error) {
            throw error;
        }
    }

    /**
     * 更新会话的消息列表
     * 
     * 此方法执行以下操作：
     * 1. 确保会话目录和消息列表文件存在
     * 2. 读取现有的消息列表
     * 3. 如果消息已存在则替换，否则添加新消息
     * 4. 将更新后的消息列表写入 JSON 文件
     * 5. 根据 data 参数写入消息内容、增量内容或错误信息
     * 
     * data 参数说明：
     * - content: 完整消息内容（覆盖写入）
     * - chunk: 增量内容（追加写入）
     * - error: 错误信息
     * 
     * @param conversation 会话对象
     * @param message 要更新/添加的消息对象
     * @param data 可选的数据（content/chunk/error）
     */
    updateConversationMessageList(conversation: IChaxConversation, message: IChaxMessage, data: {
        chunk?: string,
        content?: string,
        error?: string,
    }) {
        const messageListPath = this.getConversationMessageListJsonPath(conversation.conversationId);
        try {
            fs.accessSync(this.getConversationRootPath());
        } catch {
            fs.mkdirSync(this.getConversationRootPath(), { recursive: true });
        }

        // 确保消息存储目录存在
        try {
            fs.accessSync(this.getMessageRootPath());
        } catch {
            fs.mkdirSync(this.getMessageRootPath(), { recursive: true });
        }
        try {
            fs.accessSync(messageListPath);
        } catch {
            fs.writeFileSync(messageListPath, '[]', 'utf-8');
        }
        const content = fs.readFileSync(messageListPath, 'utf-8');
        let messages = JSON.parse(content);
        messages = messages.filter((msg: IChaxMessage) => msg.msgId !== message.msgId);
        messages.push(message);
        fs.writeFileSync(messageListPath, JSON.stringify(messages, null, 2), 'utf-8');
        if (typeof data.content === 'string') {
            fs.writeFileSync(this.getMessageContentPath(message.msgId), data.content, 'utf-8');
        }
        if (typeof data.chunk === 'string') {
            fs.writeFileSync(this.getMessageContentPath(message.msgId), data.chunk, { flag: 'a', encoding: 'utf-8' });
        }
        if (typeof data.error === 'string') {
            fs.writeFileSync(this.getMessageErrorPath(message.msgId), data.error, 'utf-8');
        }
    }

    /**
     * 消息中心 - 存储流式消息的监听回调
     * 
     * 发布-订阅模式的核心数据结构：
     * - Key: msgId (AI 消息的唯一标识)
     * - Value: 回调函数数组 (所有订阅该消息的客户端回调)
     * 
     * 工作流程：
     * 1. onSendChatMessage 创建新消息时，初始化空数组作为占位符
     * 2. onFetchStreamMessage 订阅时，将回调 push 到数组
     * 3. onChatChunk 收到流式数据时，通过 update() 遍历调用所有回调
     * 4. 流结束时调用 finish() 从 Map 中删除该 msgId
     */
    respondChunkCallMap = new Map<string, ((chunk: IChaxStreamChunk) => void)[]>();

    /**
     * 检查会话是否已完成
     * 
     * 通过检查会话消息列表中是否存在未完成的 AI 助手消息来判断。
     * 如果存在 unfinished 为 true 的 assistant 角色消息，说明会话仍在进行中。
     * 
     * @param conversationId 会话ID
     * @returns true 表示会话已完成，false 表示进行中
     */
    isConversationFinished(conversationId: string) {
        const messageListPath = this.getConversationMessageListJsonPath(conversationId);
        try {
            const content = fs.readFileSync(messageListPath, 'utf-8');
            const messages = JSON.parse(content);
            return !messages.find((msg: IChaxMessage) => this.respondChunkCallMap.has(msg.msgId));
        } catch (error) {
            return false;
        }
    }

    /**
     * 发送聊天消息
     * 
     * 这是聊天功能的核心方法，处理消息发送、AI 流式响应和回调通知。
     * 
     * 处理流程：
     * 1. 如果没有 conversationId，创建新会话
     * 2. 验证已有会话是否已完成（避免并发消息）
     * 3. 保存用户消息到文件和消息列表
     * 4. 创建 AI 助手消息（unfinished = true）
     * 5. 调用 onContinueConversation 触发 AI 流式响应
     * 6. AI 响应的每个 chunk 会：
     *    - 更新消息内容和消息列表
     *    - 通过 update() 通知所有已订阅的客户端
     * 7. 流结束时标记消息为已完成
     * 
     * 发布-订阅流程：
     * - 发布者: onContinueConversation 内部调用 onChatChunk
     * - 订阅者: onFetchStreamMessage 注册 onRespondChunk
     * - 消息中心: respondChunkCallMap 存储 msgId -> 回调列表
     * 
     * @param message 用户发送的消息内容
     * @param conversationId 可选的会话ID，不提供则创建新会话
     * @returns 包含用户消息和 AI 消息的会话对象
     * @throws 如果已有会话未完成时尝试发送新消息
     */
    async onSendChatMessage(message: string, conversationId?: string): Promise<IChaxConversation> {

        let conversation: IChaxConversation;
        if (!conversationId) {
            conversation = await this.onCreateConversation(message);

            // 确保会话根目录和list.json存在
            try {
                fs.accessSync(this.getConversationRootPath());
            } catch {
                fs.mkdirSync(this.getConversationRootPath(), { recursive: true });
            }

            const listPath = this.getConversationListJsonPath();
            try {
                fs.accessSync(listPath);
            } catch {
                fs.writeFileSync(listPath, '[]', 'utf-8');
            }

            // 将新会话添加到会话列表
            const content = fs.readFileSync(listPath, 'utf-8');
            const conversations = JSON.parse(content);
            conversations.push(conversation);
            fs.writeFileSync(listPath, JSON.stringify(conversations, null, 2), 'utf-8');
        } else {
            conversation = this.getConversation(conversationId);
            if (!this.isConversationFinished(conversation.conversationId)) {
                throw new Error('Conversation is not finished');
            }
        }
        const userMessage: IChaxMessage = {
            msgId: uuidv4(),
            role: 'user',
            unfinished: false,
            visiableInClient: true,
        };

        this.updateConversationMessageList(conversation, userMessage, {
            content: message,
        });


        const aiUnfinishedMessage: IChaxMessage = {
            msgId: uuidv4(),
            role: 'assistant',
            unfinished: true,
            visiableInClient: true,
        };

        /**
         * AI 流式响应的回调处理函数
         * 
         * 这是 onContinueConversation 传入的回调，用于处理 AI 返回的每个数据块。
         * 它同时扮演两个角色：
         * 1. 数据处理：将 chunk 保存到文件和更新消息列表
         * 2. 发布者：通过 update() 将数据广播给所有订阅的客户端
         * 
         * chunk 类型说明：
         * - init: AI 响应的初始内容（第一个块）
         * - chunk: AI 响应的后续内容块
         * - error: AI 响应出错
         * - done: AI 响应完成
         * 
         * @param chunk 流式数据块
         */
        const onChatChunk = (chunk: IChaxStreamChunk) => {
            /**
             * 流结束处理函数
             * 
             * 执行以下操作：
             * 1. 从 respondChunkCallMap 中删除该 msgId（后续订阅者会收到 done）
             * 2. 将消息标记为已完成（unfinished = false）
             * 3. 更新消息列表
             */
            const finish = () => {
                this.respondChunkCallMap.delete(aiUnfinishedMessage.msgId);
                const aiFinishedMessage: IChaxMessage = {
                    msgId: aiUnfinishedMessage.msgId,
                    role: 'assistant',
                    unfinished: false,
                    visiableInClient: true,
                };
                this.updateConversationMessageList(conversation, aiFinishedMessage, {});
            }

            /**
             * 广播函数 - 将 chunk 通知给所有已注册的回调
             * 
             * 从 respondChunkCallMap 中获取该 msgId 对应的回调列表，
             * 遍历并调用每个回调函数，实现发布-订阅模式的消息广播。
             * 
             * 注意：如果此时还没有回调注册（空数组），forEach 不会执行任何操作。
             * 这意味着早期的 chunk 可能会丢失，但后续注册的回调仍可收到新的数据。
             * 
             * @param chunk 要广播的数据块
             */
            const update = (chunk: IChaxStreamChunk) => {
                this.respondChunkCallMap.get(aiUnfinishedMessage.msgId)?.forEach(call => call(chunk));
            }

            if (chunk.type === 'init') {
                this.updateConversationMessageList(conversation, aiUnfinishedMessage, {
                    content: chunk.content,
                });
                update(chunk);

            } else if (chunk.type === 'chunk') {
                this.updateConversationMessageList(conversation, aiUnfinishedMessage, {
                    chunk: chunk.content,
                });
                update(chunk);
            } else if (chunk.type === 'error') {
                this.updateConversationMessageList(conversation, aiUnfinishedMessage, {
                    error: chunk.content,
                });
                update(chunk);
                finish();
            } else if (chunk.type === 'done') {
                update(chunk);
                finish();
            }
        };

        this.onContinueConversation(conversation.conversationId, onChatChunk);
        this.updateConversationMessageList(conversation, aiUnfinishedMessage, { chunk: '' });
        this.respondChunkCallMap.set(aiUnfinishedMessage.msgId, []);

        return conversation;
    }

    /**
     * 流式获取消息内容（订阅模式）
     * 
     * 这是发布-订阅模式中的订阅者接口。
     * 客户端通过此方法订阅消息的流式更新。
     * 
     * 处理逻辑：
     * 1. 先读取消息文件中的已有内容，通过 onRespondChunk 发送 init 类型
     * 2. 检查 respondChunkCallMap 中是否存在该 msgId：
     *    - 如果存在（流正在进行中）：将回调加入订阅列表，后续会收到实时更新
     *    - 如果不存在（流已结束）：直接发送 done，客户端可稍后通过 fetchContentMessage 获取完整内容
     * 
     * 与 onSendChatMessage 的配合：
     * - onSendChatMessage 设置 respondChunkCallMap[msgId] = [] 作为占位符
     * - onChatChunk 收到数据时调用 update() 遍历调用所有回调
     * - finish() 删除 Map 条目，后续订阅者会收到 done
     * 
     * @param msgId 消息ID
     * @param onRespondChunk 接收流式数据的回调函数
     */
    onFetchStreamMessage(msgId: string, onRespondChunk: (chunk: IChaxStreamChunk) => void): Promise<void> {

        return new Promise((res) => {
            const chunkCallList = this.respondChunkCallMap.get(msgId);

            let content = '';
            try {
                content = fs.readFileSync(this.getMessageContentPath(msgId), 'utf-8');
            } catch (err) {
                // 文件不存在，返回空内容
            }

            if (content) {
                onRespondChunk({
                    type: 'init',
                    content,
                });
            }

            if (chunkCallList) {
                chunkCallList.push((data)=>{
                    onRespondChunk(data);
                    if(data.type === 'error' || data.type === 'done'){
                        res()
                    }
                });
                return new Promise(() => { })
            } else {
                onRespondChunk({
                    type: 'done',
                    content: '',
                });

                res()
            }
        })

    }
}
