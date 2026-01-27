import { IAgxntLLM, IAgxntTool } from '../interface';
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
6. 不要直接回答问题，仅仅只是对问题的分析和归纳

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

export interface LLMToolNodeConfig {
    name: string;
    label?: string;
    description?: string;
    tool: IAgxntTool;
    conditionPrompt: string;
    callPrompt: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}

interface ShouldCallResponse {
    shouldCall: boolean;
    reason: string;
}

interface ToolCallResponse {
    toolName: string;
    arguments: Record<string, any>;
}

export class LLMToolNode implements AgentNode {
    label: string;
    metadata?: Record<string, unknown>;
    private llm: IAgxntLLM;
    private tool: IAgxntTool;
    private conditionPrompt: string;
    private callPrompt: string;

    constructor(config: LLMToolNodeConfig) {
        if (!config.llm) {
            throw new Error('LLMToolNode requires an LLM instance');
        }
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.llm = config.llm;
        this.tool = config.tool;
        this.conditionPrompt = config.conditionPrompt;
        this.callPrompt = config.callPrompt;
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const conditionMessages = this.buildConditionMessages(state);
        this.llm.setMessages(conditionMessages);

        const shouldCallResponse = await this.llm.send(state.sendChunk);
        const shouldCall = this.parseShouldCall(shouldCallResponse.content || '');

        if (!shouldCall.shouldCall) {
            state.context.push({
                role: 'assistant',
                content: shouldCall.reason,
            });
            return state;
        }

        const callMessages = this.buildCallMessages(state);
        this.llm.setMessages(callMessages);

        const toolCallResponse = await this.llm.send(state.sendChunk);
        const toolCall = this.parseToolCall(toolCallResponse.content || '');

        let toolResult: string;
        try {
            const callResult = this.tool.call(toolCall.arguments);
            toolResult = typeof callResult === 'string' ? callResult : await callResult;
        } catch (error) {
            toolResult = `工具调用错误: ${error instanceof Error ? error.message : '未知错误'}`;
        }

        state.context.push({
            role: 'assistant',
            content: `[tool: ${this.tool.info.function.name}]\n${toolResult}`,
        });

        return state;
    }

    private buildConditionMessages(state: AgentExState): { role: string; content: string }[] {
        const messages: { role: string; content: string }[] = [];

        messages.push({
            role: 'system',
            content: `${this.conditionPrompt}

## 可用工具
\`\`\`json
${JSON.stringify(this.tool.info, null, 2)}
\`\`\`

## 当前上下文
${state.context.map(m => `[${m.role}] ${m.content}`).join('\n')}

## 历史对话
${state.history.map(m => `[${m.role}] ${m.content}`).join('\n')}

请判断是否需要调用工具，仅返回 JSON 格式：
\`\`\`json
{
    "shouldCall": true 或 false,
    "reason": "调用或不调用的原因"
}
\`\`\``,
        });

        return messages;
    }

    private buildCallMessages(state: AgentExState): { role: string; content: string }[] {
        const messages: { role: string; content: string }[] = [];

        messages.push({
            role: 'system',
            content: `${this.callPrompt}

## 工具定义
\`\`\`json
${JSON.stringify(this.tool.info, null, 2)}
\`\`\`

## 当前上下文
${state.context.map(m => `[${m.role}] ${m.content}`).join('\n')}

请生成工具调用参数，仅返回 JSON 格式：
\`\`\`json
{
    "toolName": "${this.tool.info.function.name}",
    "arguments": {}
}
\`\`\``,
        });

        return messages;
    }

    private parseShouldCall(content: string): ShouldCallResponse {
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                    shouldCall: parsed.shouldCall === true,
                    reason: parsed.reason || '',
                };
            }
            const parsed = JSON.parse(content);
            return {
                shouldCall: parsed.shouldCall === true,
                reason: parsed.reason || '',
            };
        } catch {
            return { shouldCall: false, reason: `解析失败: ${content.slice(0, 100)}` };
        }
    }

    private parseToolCall(content: string): ToolCallResponse {
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                    toolName: parsed.toolName || this.tool.info.function.name,
                    arguments: parsed.arguments || {},
                };
            }
            const parsed = JSON.parse(content);
            return {
                toolName: parsed.toolName || this.tool.info.function.name,
                arguments: parsed.arguments || {},
            };
        } catch {
            return {
                toolName: this.tool.info.function.name,
                arguments: {},
            };
        }
    }
}

export function createLLMToolNode(config: LLMToolNodeConfig): LLMToolNode {
    return new LLMToolNode(config);
}

export interface NowadaysNodeConfig {
    name: string;
    label?: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export class NowadaysNode implements AgentNode {
    label: string;
    metadata?: Record<string, unknown>;

    constructor(config: NowadaysNodeConfig) {
        this.label = config.label || config.name;
        this.metadata = config.metadata;
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const now = new Date();
        const timeInfo = `当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

        state.context.push({
            role: 'system',
            content: timeInfo,
        });

        return state;
    }
}

export function createNowadaysNode(config: NowadaysNodeConfig): NowadaysNode {
    return new NowadaysNode(config);
}
