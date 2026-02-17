import { AgentNode, AgentExState } from "../graph-agant";
import { IAgxntTool, IAgxntLLM } from "../interface";

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

    static create(config: LLMToolNodeConfig): LLMToolNode {
        return new LLMToolNode(config);
    }


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



export interface LLMToolGroupNodeConfig {
    name: string;
    label?: string;
    description?: string;
    tool: IAgxntTool[];
    conditionPrompt: string;
    callPrompt: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}
export class LLMToolGroupNode implements AgentNode {

    static create(config: LLMToolGroupNodeConfig): LLMToolGroupNode {
        return new LLMToolGroupNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    private llm: IAgxntLLM;
    private tools: IAgxntTool[];
    private conditionPrompt: string;
    private callPrompt: string;

    constructor(config: LLMToolGroupNodeConfig) {
        if (!config.llm) {
            throw new Error('LLMToolGroupNode requires an LLM instance');
        }
        if (!config.tool || config.tool.length === 0) {
            throw new Error('LLMToolGroupNode requires at least one tool');
        }
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.llm = config.llm;
        this.tools = config.tool;
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

        const selectedTool = this.tools.find(t => t.info.function.name === toolCall.toolName);
        if (!selectedTool) {
            state.context.push({
                role: 'assistant',
                content: `工具 "${toolCall.toolName}" 未找到。可用工具: ${this.tools.map(t => t.info.function.name).join(', ')}`,
            });
            return state;
        }

        let toolResult: string;
        try {
            const callResult = selectedTool.call(toolCall.arguments);
            toolResult = typeof callResult === 'string' ? callResult : await callResult;
        } catch (error) {
            toolResult = `工具调用错误: ${error instanceof Error ? error.message : '未知错误'}`;
        }

        state.context.push({
            role: 'assistant',
            content: `[tool: ${selectedTool.info.function.name}]\n${toolResult}`,
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
${JSON.stringify(this.tools.map(t => t.info), null, 2)}
\`\`\`

## 当前上下文
${state.context.map(m => `[${m.role}] ${m.content}`).join('\n')}

## 历史对话
${state.history.map(m => `[${m.role}] ${m.content}`).join('\n')}

请判断是否需要调用工具，如果需要请选择最合适的工具，仅返回 JSON 格式：
\`\`\`json
{
    "shouldCall": true 或 false,
    "reason": "调用或不调用的原因",
    "selectedTool": "工具名称"
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
${JSON.stringify(this.tools.map(t => t.info), null, 2)}
\`\`\`

## 当前上下文
${state.context.map(m => `[${m.role}] ${m.content}`).join('\n')}

请生成工具调用参数，仅返回 JSON 格式：
\`\`\`json
{
    "toolName": "工具名称",
    "arguments": {}
}
\`\`\``,
        });

        return messages;
    }

    private parseShouldCall(content: string): ShouldCallGroupResponse {
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                    shouldCall: parsed.shouldCall === true,
                    reason: parsed.reason || '',
                    selectedTool: parsed.selectedTool || '',
                };
            }
            const parsed = JSON.parse(content);
            return {
                shouldCall: parsed.shouldCall === true,
                reason: parsed.reason || '',
                selectedTool: parsed.selectedTool || '',
            };
        } catch {
            return { shouldCall: false, reason: `解析失败: ${content.slice(0, 100)}`, selectedTool: '' };
        }
    }

    private parseToolCall(content: string): ToolCallResponse {
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                    toolName: parsed.toolName || '',
                    arguments: parsed.arguments || {},
                };
            }
            const parsed = JSON.parse(content);
            return {
                toolName: parsed.toolName || '',
                arguments: parsed.arguments || {},
            };
        } catch {
            return {
                toolName: '',
                arguments: {},
            };
        }
    }
}

interface ShouldCallGroupResponse {
    shouldCall: boolean;
    reason: string;
    selectedTool: string;
}