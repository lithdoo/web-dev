import { GraphAgent, AgentExState, AgentExecutionContext } from '../src/graph-agant';
import { LLMGraphRouter } from '../src/runner/Router';
import { createDeepThinkNode, createLLMAgentNode, createLLMToolNode, createNowadaysNode } from '../src/runner/Node';
import { DeepseekLLM } from '../src/deepseek';
import { ExecutionContext, ExecutionResult, ExecutionStatus, NodeExecutionRecord } from '../src/graph-base';
import { IAgxntTool } from '../src/interface';

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'https://opnxng.com';

async function searxngSearch(query: string): Promise<string> {
    const url = new URL('/search', SEARXNG_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return `搜索失败: HTTP ${response.status}`;
        }

        const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };

        if (!data.results || data.results.length === 0) {
            return `没有找到关于 "${query}" 的搜索结果`;
        }

        const topResults = data.results.slice(0, 5);
        return topResults
            .map(r => {
                const title = r.title || '无标题';
                const url = r.url || '';
                const content = r.content || '';
                return `[${title}](${url})\n${content}`;
            })
            .join('\n\n');
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            return '搜索超时，请稍后再试';
        }
        return `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
}

const llm = new DeepseekLLM();

const nowadaysNode = createNowadaysNode({
    name: 'nowadays',
    label: '获取时间',
});

const searchTool: IAgxntTool = {
    info: {
        type: 'function',
        function: {
            name: 'search',
            description: '搜索互联网获取信息',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: '搜索关键词',
                    },
                },
                required: ['query'],
            },
        },
    },
    async call(args: { query: string }) {
        console.log('搜索关键字：', args.query);
        return searxngSearch(args.query);
    },
};

const searchNode = createLLMToolNode({
    name: 'search',
    label: '搜索信息',
    tool: searchTool,
    conditionPrompt: '判断当前回答是否需要搜索额外信息来增强回答质量',
    callPrompt: '根据上下文生成搜索查询词',
    llm,
});

const thinkNode = createDeepThinkNode({
    name: 'think',
    label: '深度思考',
    systemPrompt: `## 角色
你是深度思考助手，负责对问题进行深入、全面、严谨的分析。

## 执行流程
1. nowadays: 获取当前时间信息
2. think: 对用户问题进行深度思考分析
3. answer: 根据思考结果生成回答
4. search: (可选) 如需额外信息则搜索
5. review: 评估回答质量，必要时改进

## 任务要求
1. 仔细分析用户提出的问题，理解问题的本质和深层含义
2. 从多个角度进行思考，包括：背景分析、关键因素、潜在影响、替代方案等
3. 提供结构化的推理过程，展示思考的逻辑链条
4. 在给出结论前，考虑可能的反例和边界情况
5. 保持客观中立，避免先入为主的判断
6. 特别关注问题中的时间信息（如"2026年"），结合当前时间进行判断
7. 如果需要搜索信息，之后会存在搜索的节点，需要分析整理搜索的关键字，确保搜索的内容与问题相关

## 输出格式
请直接输出你的思考内容，不要包含任何代码块标记（如 \`\`\`thinking 或 \`\`\`）。`,
    llm,
});

const answerNode = createLLMAgentNode({
    name: 'answer',
    label: '生成回答',
    systemPrompt: `## 角色
你是一个专业、友好的 AI 助手。

## 任务
根据深度思考的结果，为用户提供清晰、准确、有帮助的回答。如果上下文中有搜索结果，请结合搜索结果回答。

## 要求
1. 直接回答用户问题，不要包含任何思考过程
2. 回答要简洁明了，结构清晰
3. 如果需要，可以分点说明`,
    llm,
});

const reviewNode = createLLMAgentNode({
    name: 'review',
    label: '评价回答',
    systemPrompt: `## 角色
你是回答质量评审专家。

## 任务
评估回答的质量，从以下维度打分（1-10分）：
1. 准确性 - 回答内容是否正确
2. 完整性 - 是否覆盖了问题的各个方面
3. 清晰度 - 表达是否清晰易懂
4. 实用性 - 对用户是否有帮助

## 输出格式
请以 JSON 格式输出评审结果：
\`\`\`json
{
    "accuracy": 分数,
    "completeness": 分数,
    "clarity": 分数,
    "usefulness": 分数,
    "overall": 平均分,
    "feedback": "简短的建设性意见"
}
\`\`\``,
    llm,
});

const graph: GraphAgent = {
    entries: ['nowadays'],
    endPoints: ['review'],
    nodes: [
        { node: nowadaysNode, keyname: 'nowadays' },
        { node: thinkNode, keyname: 'think' },
        { node: answerNode, keyname: 'answer' },
        { node: searchNode, keyname: 'search' },
        { node: reviewNode, keyname: 'review' },
    ],
    edges: [
        { sourceKey: 'nowadays', targetKey: 'think', label: '获取时间' },
        { sourceKey: 'think', targetKey: 'answer', label: '直接回答' },
        { sourceKey: 'think', targetKey: 'search', label: '需要搜索' },
        { sourceKey: 'answer', targetKey: 'review', label: '直接评审' },
        { sourceKey: 'search', targetKey: 'answer', label: '可以回答' },
        { sourceKey: 'search', targetKey: 'search', label: '继续搜索' },
        { sourceKey: 'review', targetKey: 'review', label: '需要改进', condition: { prompt: 'overall 分数低于 7' } },
        { sourceKey: 'review', targetKey: 'end', label: '完成', condition: { prompt: 'overall 分数 >= 7' } },
    ],
    execute(entry, initialState) {
        const executionPath: NodeExecutionRecord[] = [];
        const startTime = new Date();
        const context: AgentExecutionContext = {
            executionId: `exec_${Date.now()}`,
            startTime,
            metadata: {},
            abort: () => { },
            pause: async () => { },
            resume: async () => { },
            status: () => ExecutionStatus.RUNNING,
            currentNodeKey: () => '',
            iterationCount: () => 0,
            getMessages: () => [],
            addMessage: () => { },
            addHistory: () => { },
            getToolCalls: () => [],
            clearToolCalls: () => { },
        };



        const run = async () => {
            const router = new LLMGraphRouter(this);
            let currentNodeKey = entry;
            let iterations = 0;
            const maxIterations = 10;

            const sendChunk = initialState.sendChunk;

            while (iterations < maxIterations) {
                iterations++;
                const node = this.nodes.find(n => n.keyname === currentNodeKey);
                if (!node) {
                    throw new Error(`Node not found: ${currentNodeKey}`);
                }

                await node.node.execute(initialState);

                if (currentNodeKey === 'review') {
                    break;
                }

                const nextKey = await router.next(currentNodeKey, initialState);
                if (nextKey === 'END' || nextKey === 'end') {
                    break;
                }
                currentNodeKey = nextKey;
            }

            const result: ExecutionResult<AgentExState> = {
                finalState: initialState,
                executionPath,
            };

            return result;
        };

        return { result: run(), context: context as unknown as ExecutionContext };
    },
    cancel() { },
    validate() {
        return { isValid: true, errors: [], warnings: [] };
    },
    config: undefined as any
};

async function main() {
    const question = process.argv[2] || '2026年国内第一次全国范围的大降温影响范围多大，持续多久';

    const state: AgentExState = {
        history: [],
        context: [{ role: 'user', content: question }] as any,
        sendChunk: (chunk) => {
            process.stdout.write(chunk.content || '');
            return Promise.resolve();
        },
    };

    console.log('\n' + '='.repeat(60));
    console.log(`问题: ${question}`);
    console.log('='.repeat(60) + '\n');

    const { result } = await graph.execute('nowadays', state);
    const { finalState } = await result;

    console.log('\n' + '='.repeat(60));
    console.log('执行完成');
    console.log('='.repeat(60));
}

main().catch(console.error);
