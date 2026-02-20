import { DeepseekLLM } from "@/deepseek";
import { AgentNode, AgentExState } from "../graph-agant";
import { IAgxntTool, IAgxntLLM, IAgxntLLMResponse } from "../interface";
import { CodeChunkSender } from "@/utils/chunk";
import { BuildPromptFunc, buildStateMessage, buildToolPrompt } from "@/utils/prompt";

export interface NativeToolNodeConfig {
    name: string;
    label?: string;
    description?: string;
    tool: IAgxntTool;
    systemPrompt?: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}

export interface NativeToolGroupNodeConfig {
    name: string;
    label?: string;
    description?: string;
    tools: IAgxntTool[];
    systemPrompt?: BuildPromptFunc<IAgxntTool[]>;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}


export class NativeToolNode implements AgentNode {

    static create(config: NativeToolNodeConfig): NativeToolNode {
        return new NativeToolNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    private llm: IAgxntLLM;
    private tool: IAgxntTool;
    private systemPrompt?: string;

    constructor(config: NativeToolNodeConfig) {
        if (!config.llm) {
            throw new Error('NativeToolNode requires an LLM instance');
        }
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.llm = config.llm.bindTools([config.tool]);
        this.tool = config.tool;
        this.systemPrompt = config.systemPrompt;
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const messages = this.buildMessages(state);
        this.llm.setMessages(messages);

        const response = await this.llm.send(state.sendChunk);
        const result = await this.parseResponse(response, state);

        return result;
    }

    private buildMessages(state: AgentExState): { role: string; content: string }[] {
        const messages: { role: string; content: string }[] = [];

        const historyContent = state.history.map(m => `[${m.role}] ${m.content}`).join('\n');
        const contextContent = state.context.map(m => `[${m.role}] ${m.content}`).join('\n');

        if (this.systemPrompt) {
            messages.push({
                role: 'system',
                content: `${this.systemPrompt}

## 工具定义
\`\`\`json
${JSON.stringify(this.tool.info, null, 2)}
\`\`\`

## 历史对话
${historyContent}

## 当前上下文
${contextContent}`,
            });
        }

        const lastUserMessage = [...state.history, ...state.context]
            .reverse()
            .find(m => m.role === 'user');

        if (lastUserMessage) {
            messages.push({
                role: 'user',
                content: lastUserMessage.content,
            });
        }

        return messages;
    }

    private async parseResponse(response: IAgxntLLMResponse, state: AgentExState): Promise<AgentExState> {
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            const args = toolCall.function?.arguments
                ? JSON.parse(toolCall.function.arguments)
                : {};

            let toolResult: string;
            try {
                const callResult = this.tool.call(args);
                toolResult = typeof callResult === 'string' ? callResult : await callResult;
            } catch (error) {
                toolResult = `工具调用错误: ${error instanceof Error ? error.message : '未知错误'}`;
            }

            state.context.push({
                role: 'assistant',
                content: `[tool: ${this.tool.info.function.name}]\n${toolResult}`,
            });
        } else {
            state.context.push({
                role: 'assistant',
                content: response.content || '',
            });
        }

        return state;
    }
}

export class NativeToolGroupNode implements AgentNode {

    static create(config: NativeToolGroupNodeConfig): NativeToolGroupNode {
        return new NativeToolGroupNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    private llm: IAgxntLLM;
    public tools: IAgxntTool[];
    private systemPrompt?: BuildPromptFunc<IAgxntTool[]>;

    constructor(config: NativeToolGroupNodeConfig) {
        if (!config.llm) {
            throw new Error('NativeToolGroupNode requires an LLM instance');
        }
        if (!config.tools || config.tools.length === 0) {
            throw new Error('NativeToolGroupNode requires at least one tool');
        }
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.llm = config.llm.bindTools(config.tools);
        this.tools = config.tools;
        this.systemPrompt = config.systemPrompt;
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const systemPromptContent = buildToolPrompt(() => this.tools, this.systemPrompt);
        const messages = buildStateMessage(state, systemPromptContent);
        this.llm.setMessages(messages)
        this.llm.bindTools(this.tools);

        const response = await this.llm.send();
        new CodeChunkSender(state.sendChunk)
            .start('[tool-group-execute-content]')
            .content('content:\n')
            .content(response.content || '无调用内容')
            .content('\n')
            .content('tool_calls:\n')
            .content(response.tool_calls?.length ? JSON.stringify(response.tool_calls, null, 2) : '无调用')
            .finish();
        const result = await this.parseResponse(response, state);

        return result;
    }

    private async parseResponse(response: IAgxntLLMResponse, state: AgentExState): Promise<AgentExState> {
        while (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            const toolName = toolCall.function?.name || '';
            const args = toolCall.function?.arguments
                ? JSON.parse(toolCall.function.arguments)
                : {};

            const selectedTool = this.tools.find(t => t.info.function.name === toolName);

            if (!selectedTool) {
                const content = `工具 "${toolName}" 未找到。可用工具: ${this.tools.map(t => t.info.function.name).join(', ')}`
                state.context.push({ role: 'assistant', content, title: '工具调用错误' });
                new CodeChunkSender(state.sendChunk)
                    .start(`[tool-group-call-error]${toolName}`)
                    .content(content)
                    .finish();
                return state;
            }else{
                 state.context.push({
                    role: 'assistant',
                    content: `调用工具 "${toolName}" ，参数: ${JSON.stringify(args)}`,
                    title: '工具调用请求',
                });
            }

            let toolResult: string;
            try {
                const callResult = selectedTool.call(args);
                toolResult = typeof callResult === 'string' ? callResult : await callResult;
            } catch (error) {
                toolResult = `工具调用错误: ${error instanceof Error ? error.message : '未知错误'}`;
            }

            state.context.push({
                role: 'assistant',
                content: `[tool: ${selectedTool.info.function.name}]\n${toolResult}`,
                title: '工具调用结果',
            });

            new CodeChunkSender(state.sendChunk)
                .start(`[tool-group-call-success]${toolName}`)
                .content(toolResult)
                .finish();

            response.tool_calls.shift();
        }

        state.context.push({
            role: 'assistant',
            content: '工具调用结束',
            title: '工具调用结果',
        });

        return state;
    }
}
