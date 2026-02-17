import { DeepseekLLM } from "@/deepseek";
import { AgentNode, AgentExState } from "../graph-agant";
import { IAgxntTool, IAgxntLLM, IAgxntLLMResponse } from "../interface";
import { CodeChunkSender } from "@/utils/chunk";

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
    systemPrompt?: string | ((tools: IAgxntTool[]) => string);
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}

export interface NativeToolReActNodeConfig {
    name: string;
    label?: string;
    description?: string;
    tools: IAgxntTool[];
    observePrompt?: string | ((tools: IAgxntTool[]) => string);
    callPrompt?: string | ((tools: IAgxntTool[]) => string);
    llmCall?: IAgxntLLM;
    llmObserve?: IAgxntLLM;
    maxIterations?: number;
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
    private systemPrompt?: string | ((tools: IAgxntTool[]) => string);

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
        const messages = this.buildMessages(state);
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

    private buildMessages(state: AgentExState): { role: string; content: string }[] {
        const messages: { role: string; content: string }[] = [];

        // const historyContent = state.history.map(m => `[${m.role}] ${m.content}`).join('\n');
        const contextContent = state.context.map(m => `[${m.role}] ${m.content}`).join('\n');

        let systemPromptContent = '';
        if (typeof this.systemPrompt === 'function') {
            systemPromptContent = this.systemPrompt(this.tools);
        } else if (this.systemPrompt) {
            systemPromptContent = this.systemPrompt;
        }

        if (systemPromptContent) {
            messages.push({
                role: 'system',
                content: `${systemPromptContent}

## 当前上下文
${contextContent}`,
            });
        }

        // const lastUserMessage = [...state.history, ...state.context]
        //     .reverse()
        //     .find(m => m.role === 'user');

        // if (lastUserMessage) {
        //     messages.push({
        //         role: 'user',
        //         content: lastUserMessage.content,
        //     });
        // }

        return [...state.history, ...state.context];
    }

    private async parseResponse(response: IAgxntLLMResponse, state: AgentExState): Promise<AgentExState> {
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            const toolName = toolCall.function?.name || '';
            const args = toolCall.function?.arguments
                ? JSON.parse(toolCall.function.arguments)
                : {};

            const selectedTool = this.tools.find(t => t.info.function.name === toolName);

            if (!selectedTool) {
                const content = `工具 "${toolName}" 未找到。可用工具: ${this.tools.map(t => t.info.function.name).join(', ')}`
                state.context.push({ role: 'assistant', content });
                new CodeChunkSender(state.sendChunk)
                    .start(`[tool-group-call-error]${toolName}`)
                    .content(content)
                    .finish();
                return state;
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
            });
            new CodeChunkSender(state.sendChunk)
                .start(`[tool-group-call-success]${toolName}`)
                .content(toolResult)
                .finish();
        } else {
            state.context.push({
                role: 'assistant',
                content: response.content || '',
            });
        }

        return state;
    }
}

export type BuildPromptFunc<T> = string | ((tools: T) => string);
export class NativeToolReActNode implements AgentNode {

    static create(config: NativeToolReActNodeConfig): NativeToolReActNode {
        return new NativeToolReActNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    private groupNode: NativeToolGroupNode;
    private maxIterations: number;
    private observePrompt?: string
    private observeLLM: IAgxntLLM;

    get tools() {
        return this.config.tools;
    }

    constructor(private config: NativeToolReActNodeConfig) {
        if (!config.llmCall) {
            throw new Error('NativeToolReActNode requires an LLM instance');
        }
        if (!config.tools || config.tools.length === 0) {
            throw new Error('NativeToolReActNode requires at least one tool');
        }

        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.maxIterations = config.maxIterations || 5;

        const observePrompt = this.buildPrompt(`你是一个智能助手，负责分析用户需求并决定是否需要调用工具来完成任务。

## 可用工具
\`\`\`json
${JSON.stringify(this.tools.map(t => t.info), null, 2)}
\`\`\`

## 决策规则
1. 仔细分析用户的问题和需求
2. 判断是否有合适的工具可以帮你回答或解决问题
3. 如果有多个可用工具，选择最合适的一个
4. 如果不需要工具，直接返回空字符串

## 输出要求
- **需要工具时**：请回复需要哪些工具，以及为什么需要这些工具。
- **不需要工具时**：直接返回空字符串`, config.observePrompt);
        const callPrompt = this.buildPrompt(`你是一个工具助手，请根据用户需求选择合适的工具。

## 可用工具
${this.tools.map(t =>
            `- ${t.info.function.name}: ${t.info.function.description}`
        ).join('\n')}

## 规则
1. 仔细阅读用户需求，选择最合适的工具
2. 如果不需要调用工具，返回空字符串
3. 确保参数正确
            `, config.callPrompt);

        this.groupNode = new NativeToolGroupNode({
            name: `${config.name}_group`,
            tools: config.tools,
            systemPrompt: callPrompt,
            llm: config.llmCall,
        });
        this.observePrompt = observePrompt;
        this.observeLLM = config.llmObserve ?? new DeepseekLLM();
    }

    private buildPrompt(
        defaultPrompt: BuildPromptFunc<IAgxntTool[]>,
        prompt?: BuildPromptFunc<IAgxntTool[]>
    ): string {
        const tools = this.config.tools
        // const toolsJson = JSON.stringify(tools.map(t => t.info), null, 2);

        if (typeof prompt === 'function') {
            return prompt(tools);
        } else if (typeof prompt === 'string') {
            return prompt
        } else if (typeof defaultPrompt === 'function') {
            return defaultPrompt(tools);
        } else if (defaultPrompt) {
            return defaultPrompt;
        }

        throw new Error('NativeToolReActNode requires a prompt function or string');
    }


    async execute(state: AgentExState): Promise<AgentExState> {
        let iterations = 0;

        while (iterations < this.maxIterations) {
            iterations++;

            const shouldCall = await this.observe(state);
            if (!shouldCall) {
                break;
            } else {
                await this.groupNode.execute(state);
            }
        }

        return state;
    }

    private async observe(state: AgentExState): Promise<boolean> {
        const messages = this.buildThinkMessages(state);
        this.observeLLM.setMessages(messages);

        const response = await this.observeLLM.send(() => { });
        const shouldCall = !!response.content?.trim();

        if (shouldCall) {
            state.context.push({
                role: 'assistant',
                content: `[思考] ${response}`,
            });
            new CodeChunkSender(state.sendChunk)
                .start('[tool-react-assessment]')
                .content(response.content?.trim() || '无思考内容')
                .finish();
        } else {
            state.sendChunk({
                type: 'chunk', content: `\n[工具调用评估] 工具调用完毕。\n`
            });
            new CodeChunkSender(state.sendChunk)
                .start('[tool-react-assessment]')
                .content('工具调用完毕。')
                .finish();
        }

        return shouldCall
    }


    private buildThinkMessages(state: AgentExState): { role: string; content: string }[] {
        const contextContent = state.context.map(m => `[${m.role}] ${m.content}`).join('\n');

        const messages: { role: string; content: string }[] = [{
            role: 'system',
            content: `${this.observePrompt}
## 当前上下文
${contextContent}`,
        }];

        const lastUserMessage = [...state.history, ...state.context]
            .reverse()
            .find(m => m.role === 'user');

        if (lastUserMessage) {
            messages.push({
                role: 'user',
                content: lastUserMessage.content,
            });
        }

        return [...state.history, ...messages];
    }

}
