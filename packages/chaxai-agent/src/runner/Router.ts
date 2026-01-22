import { GraphRouter, GraphAgent, AgentExState, AgentEdgeCondition } from '../graph-agant';
import { DeepseekLLM } from '../deepseek';
import { IAgxntLLM } from '../interface';

export interface LLMGraphRouterConfig {
    llm?: IAgxntLLM;
    systemPrompt?: string;
}

/**
 * 基于 LLM 的图路由决策器
 * 
 * 通过分析当前节点状态和可用路由，让 LLM 智能决定下一个跳转的节点
 */
export class LLMGraphRouter implements GraphRouter {
    graph: GraphAgent;
    private llm: IAgxntLLM;
    private systemPrompt: string;

    constructor(graph: GraphAgent, config: LLMGraphRouterConfig = {}) {
        this.graph = graph;
        this.llm = config.llm || new DeepseekLLM();
        this.systemPrompt = config.systemPrompt || `## 角色
你是一个智能工作流路由专家，负责根据对话状态和可用路由规则，决定 AI Agent 下一步应该执行哪个节点。

## 当前状态

**当前节点**: {currentNode}

**执行上下文**:
{contextSummary}

**历史摘要**:
{historySummary}

## 可用路由规则
{routes}

## 决策指南

1. **理解用户意图**: 分析上下文中的用户输入，判断用户真正想要什么

2. **评估路由条件**: 
   - 优先检查每条路由的条件（condition），判断是否满足
   - 条件可能包括：意图匹配、状态检查、参数验证等

3. **选择最佳路由**:
   - 优先选择满足条件的路由
   - 如果多条路由都满足条件，选择最符合用户当前意图的那个
   - 如果没有满足条件的路由，选择标记为"无条件"的默认路由
   - 如果没有默认路由，选择第一条路由

4. **结束判断**: 如果当前节点是终点节点（如 final、end、result 等），直接返回 "END"

## 输出要求

请仅返回目标节点的 key 字符串，不要包含任何解释、标点或格式。

例如：如果应该跳转到 "analyze_topic"，直接返回：
analyze_topic`;
    }

    /**
     * 获取下一个应该跳转的节点
     * 
     * @param currentNodeKey 当前节点 key
     * @param state 当前执行状态
     * @returns 下一个节点的 key，或 "END" 表示结束
     */
    async next(currentNodeKey: string, state: AgentExState): Promise<string> {
        const edges = this.getOutgoingEdges(currentNodeKey);

        if (this.isEndNode(currentNodeKey, edges)) {
            console.log(`\n🚦 路由决策结果: END (终点节点)`);
            return 'END';
        }

        const routeDescriptions = this.buildRouteDescriptions(edges);
        const contextSummary = this.buildContextSummary(state);
        const historySummary = await this.buildHistorySummary(state);
        const prompt = this.buildPrompt(routeDescriptions, currentNodeKey, contextSummary, historySummary);

        const messages = this.buildMessages(prompt);
        this.llm.setMessages(messages);

        const response = await this.llm.send(() => {});
        const targetKey = this.parseResponse(response, edges);

        console.log(`\n🚦 路由决策结果: ${targetKey} (从 ${currentNodeKey} 跳转)`);

        return targetKey;
    }

    /**
     * 获取当前节点的所有出边
     * 
     * @param currentNodeKey 当前节点 key
     * @returns 当前节点的出边数组
     */
    private getOutgoingEdges(currentNodeKey: string) {
        return this.graph.edges.filter(e => e.sourceKey === currentNodeKey);
    }

    /**
     * 判断当前节点是否为终点
     * 
     * 如果没有出边，或者节点在 endPoints 列表中，则认为是终点
     * 
     * @param currentNodeKey 当前节点 key
     * @param edges 当前节点的出边数组
     * @returns 是否为终点
     */
    private isEndNode(currentNodeKey: string, edges: any[]): boolean {
        if (edges.length === 0) {
            return true;
        }
        const endNodes = (this.graph as any).endPoints || [];
        return endNodes.includes(currentNodeKey);
    }

    /**
     * 构建路由描述文本
     * 
     * 将每条边的目标节点、标签和条件提示格式化为可读文本
     * 
     * @param edges 出边数组
     * @returns 格式化的路由描述
     */
    private buildRouteDescriptions(edges: any[]): string {
        return edges.map((edge, index) => {
            const condition = edge.condition as AgentEdgeCondition | undefined;
            return `${index + 1}. 目标节点: ${edge.targetKey}
   标签: ${edge.label || '无'}
   条件提示: ${condition?.prompt || '无条件'}`.trim();
        }).join('\n');
    }

    /**
     * 获取当前执行上下文的内容
     * 
     * 返回 context 中的全部原始内容
     * 
     * @param state 当前执行状态
     * @returns context 中的全部内容
     */
    private getContextContent(state: AgentExState): string {
        if (state.context.length > 0) {
            return state.context.map(m => (m as any).content || '').join('\n');
        }
        return '无';
    }

    /**
     * 构建当前执行上下文摘要
     * 
     * 返回 context 中的全部原始内容（用于 LLM 决策）
     * 
     * @param state 当前执行状态
     * @returns context 内容摘要
     */
    private buildContextSummary(state: AgentExState): string {
        if (state.context.length === 0) {
            return '[当前执行上下文：无]';
        }
        return `[当前执行上下文（共 ${state.context.length} 条消息）]\n` +
            state.context.map((m, i) => {
                const content = (m as any).content || '';
                const role = (m as any).role || 'unknown';
                return `${i + 1}. [${role}]: ${content}`;
            }).join('\n');
    }

    /**
     * 构建历史对话摘要
     * 
     * 通过 LLM 压缩历史对话为简短摘要，保留关键信息
     * 
     * @param state 当前执行状态
     * @returns 历史对话摘要
     */
    private async buildHistorySummary(state: AgentExState): Promise<string> {
        if (state.history.length === 0) {
            return '[无历史对话]';
        }

        const historyText = state.history.map(h => `${h.role}: ${h.content}`).join('\n');

        const compressPrompt = `请将以下对话历史压缩为简洁摘要，保留关键信息（用户意图、已完成的操作、当前状态等），不超过 200 字：

=== 对话历史 ===
${historyText}
===

请直接返回摘要，不需要任何前缀或解释。`;

        const compressMessages = [
            { role: 'user', content: compressPrompt }
        ];

        this.llm.setMessages(compressMessages);
        const response = await this.llm.send(() => {});

        return `[历史对话摘要]\n${(response.content || '').trim()}`;
    }

    /**
     * 构建完整的 prompt
     * 
     * 将系统模板中的占位符替换为实际内容
     * 
     * @param routeDescriptions 路由描述
     * @param currentNodeKey 当前节点 key
     * @param contextSummary 上下文摘要
     * @param historySummary 历史对话摘要
     * @returns 完整的 prompt 字符串
     */
    private buildPrompt(
        routeDescriptions: string,
        currentNodeKey: string,
        contextSummary: string,
        historySummary: string
    ): string {
        return this.systemPrompt
            .replace('{routes}', routeDescriptions)
            .replace('{currentNode}', currentNodeKey)
            .replace('{contextSummary}', contextSummary)
            .replace('{historySummary}', historySummary);
    }

    /**
     * 构建发送给 LLM 的消息数组
     * 
     * 包含 system prompt 和 user 请求
     * 
     * @param prompt 完整的 prompt 字符串
     * @returns 消息数组
     */
    private buildMessages(prompt: string) {
        return [
            { role: 'system', content: prompt },
            { role: 'user', content: '请根据以上信息，选择下一个应该跳转的节点。' }
        ];
    }

    /**
     * 解析 LLM 的响应
     * 
     * 验证返回的节点 key 是否有效，如果无效则使用默认路由
     * 
     * @param response LLM 响应
     * @param edges 可用的出边数组
     * @returns 有效的目标节点 key
     */
    private parseResponse(response: any, edges: any[]): string {
        const targetKey = (response.content || '').trim();
        const validTargets = edges.map(e => e.targetKey);

        if (validTargets.includes(targetKey)) {
            return targetKey;
        }

        const defaultEdge = edges.find(e => !e.condition);
        if (defaultEdge) {
            return defaultEdge.targetKey;
        }

        return edges[0]?.targetKey || 'END';
    }
}
