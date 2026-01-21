import { IAgxntLLM } from '../interface';
import { AgentNode, AgentExState } from '../graph-agant';

export interface LLMAgentNodeConfig {
    name: string;
    label?: string;
    description?: string;
    systemPrompt: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}

interface MessageInput {
    role: string;
    content: string;
}

export class LLMAgentNode implements AgentNode {
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

        const response = await this.llm.send(state.sendChunk);

        state.context.push({
            role: 'assistant',
            content: response.content || '',
        });

        return state;
    }

    protected async buildMessages(state: AgentExState): Promise<MessageInput[]> {
        const messages: MessageInput[] = [];

        if (this.systemPrompt) {
            messages.push({ role: 'system', content: this.systemPrompt });
        }

        for (const msg of state.context) {
            messages.push({
                role: msg.role,
                content: msg.content || '',
            });
        }

        for (const msg of state.history) {
            messages.push({
                role: msg.role,
                content: msg.content || '',
            });
        }

        return messages;
    }
}

export function createLLMAgentNode(config: LLMAgentNodeConfig): LLMAgentNode {
    return new LLMAgentNode(config);
}

const DEFAULT_DEEP_THINK_PROMPT = `## 角色
你是深度思考助手，负责对问题进行深入、全面、严谨的分析。

## 任务要求
1. 仔细分析用户提出的问题，理解问题的本质和深层含义
2. 从多个角度进行思考，包括：背景分析、关键因素、潜在影响、替代方案等
3. 提供结构化的推理过程，展示思考的逻辑链条
4. 在给出结论前，考虑可能的反例和边界情况
5. 保持客观中立，避免先入为主的判断

## 输出格式
请直接输出你的思考内容，不要包含任何代码块标记（如 \`\`\`thinking 或 \`\`\`）。`;

export interface DeepThinkNodeConfig extends Omit<LLMAgentNodeConfig, 'systemPrompt'> {
    thinkPrompt?: string;
    systemPrompt?: string;
}

export class DeepThinkNode extends LLMAgentNode {
    constructor(config: DeepThinkNodeConfig) {
        const systemPrompt = config.systemPrompt || DEFAULT_DEEP_THINK_PROMPT;
        super({
            ...config,
            systemPrompt,
            label: config.label || config.name,
        });
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const messages = await this.buildMessages(state);

        this.llm.setMessages(messages);

        state.sendChunk({ type: 'chunk', content: '```thinking\n' });

        const response = await this.llm.send(state.sendChunk);

        state.sendChunk({ type: 'chunk', content: '\n```\n' });

        const content = response.content || '';

        state.context.push({
            role: 'assistant',
            content: `【深度思考结果】${content}`,
        });

        return state;
    }
}

export function createDeepThinkNode(config: DeepThinkNodeConfig): DeepThinkNode {
    return new DeepThinkNode(config);
}
