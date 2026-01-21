import { GraphAgent, AgentExState, AgentEdge, AgentExecutionContext } from '../src/graph-agant';
import { LLMGraphRouter } from '../src/runner/Router';
import { DeepThinkNode, LLMAgentNode, createDeepThinkNode, createLLMAgentNode } from '../src/runner/Node';
import { DeepseekLLM } from '../src/deepseek';
import { ExecutionContext, ExecutionResult, ExecutionStatus, NodeExecutionRecord } from '../src/graph-base';

const llm = new DeepseekLLM();

const thinkNode = createDeepThinkNode({
    name: 'think',
    label: '深度思考',
    llm,
});

const answerNode = createLLMAgentNode({
    name: 'answer',
    label: '生成回答',
    systemPrompt: `## 角色
你是一个专业、友好的 AI 助手。

## 任务
根据深度思考的结果，为用户提供清晰、准确、有帮助的回答。

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
    entries: ['think'],
    endPoints: ['review'],
    nodes: [
        { node: thinkNode, keyname: 'think' },
        { node: answerNode, keyname: 'answer' },
        { node: reviewNode, keyname: 'review' },
    ],
    edges: [
        { sourceKey: 'think', targetKey: 'answer', label: '思考完成' },
        { sourceKey: 'answer', targetKey: 'review', label: '待评审' },
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
    const question = process.argv[2] || '为什么天空是蓝色的？';

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

    const { result } = await graph.execute('think', state);
    const { finalState } = await result;

    console.log('\n' + '='.repeat(60));
    console.log('执行完成');
    console.log('='.repeat(60));
}

main().catch(console.error);
