import {
    NodeExecutionRecord,
    ExecutionStatus
} from './graph-base';
import {
    AgentState,
    AgentMessage,
    HistoryMessage,
    ToolCall,
    ToolMessage,
    AIMessageInAgent
} from './graph-llm';
import {
    GraphAgent,
    AgentGraphConfig,
    AgentNode,
    AgentEdge,
    AgentEdgeCondition,
    AgentExecutionContext,
    AgentExecutionResult,
    GraphAgentBuilder,
} from './graph-agant';
import { IAgxntLLM, IAgxntTool } from './interface';
import { IChaxStreamChunk } from '@chaxai-common';
import { v4 as uuidv4 } from 'uuid';
import { DeepseekLLM } from './deepseek';

class DefaultAgentExecutionContext implements AgentExecutionContext {
    private _iterationCount = 0;
    private _messages: AgentMessage[] = [];
    private _toolCalls: ToolCall[] = [];
    private _status: ExecutionStatus = ExecutionStatus.PENDING;
    private _abortController = new AbortController();

    constructor(
        public readonly executionId: string,
        public readonly startTime: Date,
        public readonly metadata: Record<string, unknown>,
        private onStatusChange?: (status: ExecutionStatus) => void
    ) {}

    currentNodeKey(): string {
        return this.metadata['currentNodeKey'] as string || '';
    }

    iterationCount(): number {
        return this._iterationCount;
    }

    getMessages(): AgentMessage[] {
        return this._messages;
    }

    addMessage(message: AgentMessage): void {
        this._messages.push(message);
    }

    addHistory(message: HistoryMessage): void {
        this.metadata['history'] = this.metadata['history'] as HistoryMessage[] || [];
        (this.metadata['history'] as HistoryMessage[]).push(message);
    }

    getToolCalls(): ToolCall[] {
        return this._toolCalls;
    }

    addToolCall(toolCall: ToolCall): void {
        this._toolCalls.push(toolCall);
    }

    clearToolCalls(): void {
        this._toolCalls = [];
    }

    abort(): void {
        this._abortController.abort();
        this.updateStatus(ExecutionStatus.CANCELLED);
    }

    async pause(): Promise<void> {
        this.updateStatus(ExecutionStatus.PENDING);
    }

    async resume(): Promise<void> {
        this.updateStatus(ExecutionStatus.RUNNING);
    }

    status(): ExecutionStatus {
        return this._status;
    }

    incrementIteration(): void {
        this._iterationCount++;
    }

    setCurrentNode(nodeKey: string): void {
        this.metadata['currentNodeKey'] = nodeKey;
    }

    updateStatus(status: ExecutionStatus): void {
        this._status = status;
        this.onStatusChange?.(status);
    }

    get abortSignal(): AbortSignal {
        return this._abortController.signal;
    }
}

class DefaultAgentExecutionResult implements AgentExecutionResult {
    constructor(
        public finalState: AgentState,
        public executionPath: NodeExecutionRecord[],
        public success: boolean,
        public finalMessage: string | undefined,
        public iterations: number
    ) {}
}

class LLMNode implements AgentNode {
    label: string;
    metadata?: Record<string, unknown>;
    private llm: IAgxntLLM;
    private tools: IAgxntTool[];
    private systemPrompt?: string;

    constructor(
        key: string,
        label: string,
        llm: IAgxntLLM,
        tools: IAgxntTool[] = [],
        systemPrompt?: string
    ) {
        this.label = label;
        this.metadata = { key };
        this.llm = llm;
        this.tools = tools;
        this.systemPrompt = systemPrompt;
    }

    async run(state: AgentState): Promise<AgentState> {
        const messages = this.buildMessages(state);

        this.llm.setMessages(messages);
        if (this.tools.length > 0) {
            this.llm.bindTools(this.tools);
        }

        let assistantMessage: AIMessageInAgent | null = null;

        await this.llm.send((chunk: IChaxStreamChunk) => {
            state.sendChunk(chunk);
        });

        const lastMessage = state.context[state.context.length - 1];
        if (lastMessage?.role === 'assistant') {
            assistantMessage = lastMessage as AIMessageInAgent;
        }

        if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
            for (const toolCall of assistantMessage.tool_calls) {
                const toolResult = await this.executeTool(toolCall, state);
                state.context.push(toolResult);
            }
            state.context.push({
                role: 'assistant',
                content: assistantMessage.content || ''
            });
        }

        if (assistantMessage?.content) {
            state.context.push({
                role: 'assistant',
                content: assistantMessage.content
            });
        }

        return state;
    }

    private buildMessages(state: AgentState): Array<{ role: string; content: string }> {
        const messages: Array<{ role: string; content: string }> = [];

        if (this.systemPrompt) {
            messages.push({ role: 'system', content: this.systemPrompt });
        }

        for (const msg of state.history) {
            messages.push({ role: msg.role, content: msg.content });
        }

        for (const msg of state.context) {
            if ('content' in msg) {
                messages.push({ role: msg.role, content: msg.content as string });
            }
        }

        return messages;
    }

    private async executeTool(toolCall: ToolCall, state: AgentState): Promise<ToolMessage> {
        const toolName = toolCall.function.name;
        const args = toolCall.function.arguments;

        let result = `Unknown tool: ${toolName}`;

        const tool = this.tools.find(t => t.info.function.name === toolName);
        if (tool) {
            try {
                const parsedArgs = JSON.parse(args || '{}');
                result = await tool.call(parsedArgs);
            } catch (e) {
                result = `Tool execution error: ${e}`;
            }
        }

        return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result
        };
    }

    snapshot(state: AgentState): unknown {
        return {
            nodeLabel: this.label,
            contextLength: state.context.length,
            historyLength: state.history.length,
            timestamp: new Date().toISOString()
        };
    }
}

class SimpleAgentEdge implements AgentEdge {
    sourceKey: string;
    targetKey: string;
    label: string;
    metadata?: Record<string, unknown>;
    condition?: AgentEdgeCondition;

    constructor(sourceKey: string, targetKey: string, label: string = '', condition?: AgentEdgeCondition) {
        this.sourceKey = sourceKey;
        this.targetKey = targetKey;
        this.label = label;
        this.condition = condition;
    }
}




GraphAgentBuilder.create({
    name: 'test',
    maxIterations: 10,
    timeout: 10000,
}).initNodes({
    'start': new LLMNode(
        'start',
        'start',
        new DeepseekLLM(),
        [],
        '你是一个智能助手，你的任务是回答用户的问题。'
    ),
})