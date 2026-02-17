import { AgentNode, AgentExState } from "../graph-agant";
import { IAgxntLLM } from "../interface";
interface MessageInput {
    role: string;
    content: string;
}

export interface LLMAgentNodeConfig {
    name: string;
    label?: string;
    description?: string;
    systemPrompt: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}

export class BaseLLMNode implements AgentNode {
    static create(config: LLMAgentNodeConfig): BaseLLMNode {
        return new BaseLLMNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    protected systemPrompt: string;
    protected llm: IAgxntLLM;

    constructor(config: LLMAgentNodeConfig) {
        if (!config.llm) {
            throw new Error('LLMAgentNode requires an LLM instance');
        }
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.systemPrompt = config.systemPrompt;
        this.llm = config.llm;
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const messages = await this.buildMessages(state);

        this.llm.setMessages(messages);

        state.sendChunk({
            type: 'chunk',
            content:  '\n',
        });

        const response = await this.llm.send(state.sendChunk);

        state.context.push({
            role: 'assistant',
            content: response.content || '',
        });

        return state;
    }

    protected async buildMessages(state: AgentExState): Promise<MessageInput[]> {
        const messages: MessageInput[] = [];

        for (const msg of state.history) {
            messages.push({
                role: msg.role,
                content: msg.content || '',
            });
        }

        for (const msg of state.context) {
            messages.push({
                role: msg.role,
                content: msg.content || '',
            });
        }

        if (this.systemPrompt) {
            messages.push({ role: 'system', content: this.systemPrompt });
        }

        return messages;
    }
}


