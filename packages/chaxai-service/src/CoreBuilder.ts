import { IMessage, IChaxConversation, IChaxConversationManager, IChaxHistroyService, IChaxMessageInfo, IChaxStreamChunk } from "@chaxai-common";
// import { ChatDeepSeek } from "@langchain/deepseek";
import { v4 as uuidv4 } from 'uuid';
import { ChaxKoaMiddleWare } from "./KoaMiddleWare";
// import { ChaxFileService } from "./FileService";
import { ChaxFSDBService } from "./FSDBService";


export interface IChaxCore {
    onChat(
        // llm: ChatDeepSeek,
        history: IMessage[],
        sendChunk: (chunk: IChaxStreamChunk) => void
    ): void
}

export class CoreConversationManager implements IChaxConversationManager {


    constructor(
        private core: IChaxCore,
        private history: IChaxHistroyService,
        // private llm = () => {
        //     const DEEPSEEK_API_KEY = 'sk-5069284b93a7481db08a15f65628906a';
        //     return new ChatDeepSeek({
        //         model: 'deepseek-chat',
        //         apiKey: DEEPSEEK_API_KEY,
        //         temperature: 0.7,
        //     });
        // }
    ) {}


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
    async onContinueConversation(conversationId: string, onChunk: (chunk: IChaxStreamChunk) => void) {

        let messages: IChaxMessageInfo[];

        try {
            messages = await this.history.onFetchChatMessages(conversationId);
        } catch (error) {
            onChunk({
                type: 'error',
                content: error instanceof Error ? error.message : 'Failed to fetch conversation history'
            });
            return;
        }


        const conversationMessages: IMessage[] = await Promise.all(
            messages
                .filter((msg: IChaxMessageInfo) => msg.visiableInClient)
                .map(async (msg: IChaxMessageInfo) => {
                    let content: string;
                    try {
                        const result = await this.history.onFetchContentMessage(msg.msgId);
                        content = result.content ? result.content : `生成失败: ${result.error || 'Unknown error'}`;
                    } catch (error) {
                        content = `生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    }
                    return {
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content,
                    };
                })
        );
        this.core.onChat(
            // this.llm(),
            conversationMessages,
            onChunk
        );
    }

}

export class CoreChaxKoaMiddleWare extends ChaxKoaMiddleWare {
    constructor(
        core: IChaxCore,
        // llm?: ()=> ChatDeepSeek
    ) {
        super(
            ChaxFSDBService.build({
                build: (history: IChaxHistroyService) => new CoreConversationManager(core, history),
            })
        );
    }
}