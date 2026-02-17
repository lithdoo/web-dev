import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from 'koa2-cors';
import { GraphAgent, AgentExState, AgentExecutionContext } from '../src/graph-agant';
import { LLMGraphRouter } from '../src/runner/Router';
import { DeepseekLLM } from '../src/deepseek';
import { ExecutionContext, ExecutionResult, ExecutionStatus, NodeExecutionRecord } from '../src/graph-base';
import { createSearchTool } from './tools';
import { CoreChaxKoaMiddleWare, IChaxCore } from '../../chaxai-service/src/CoreBuilder';
import { IChaxStreamChunk, IMessage } from '@chaxai-common';
import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseLLMNode, DeepThinkNode, LLMToolNode, NowadaysNode } from '@/nodes';


const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-5069284b93a7481db08a15f65628906a';

function createLLM(): ChatDeepSeek {
    return new ChatDeepSeek({
        model: 'deepseek-chat',
        apiKey: DEEPSEEK_API_KEY,
        temperature: 0.7,
    });
}

const llm = new DeepseekLLM();

const nowadaysNode = NowadaysNode.create({
    name: 'nowadays',
    label: '获取时间',
});

const searchTool = createSearchTool({
    baseUrl: SEARXNG_BASE_URL,
    timeout: 60000,
});

const searchNode = LLMToolNode.create({
    name: 'search',
    label: '搜索信息',
    tool: searchTool,
    conditionPrompt: '判断当前回答是否需要搜索额外信息来增强回答质量',
    callPrompt: '根据上下文生成搜索查询词',
    llm,
});

const thinkNode = DeepThinkNode.create({
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

const answerNode = BaseLLMNode.create({
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

const reviewNode = BaseLLMNode.create({
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

class GraphChatCore implements IChaxCore {
    onChat(llm: ChatDeepSeek, history: IMessage[], sendChunk: (chunk: IChaxStreamChunk) => void): void {
        const lastMessage = history[history.length - 1];
        const currentInput = lastMessage?.role === 'user' ? lastMessage.content : '';

        const state: AgentExState = {
            history: history.slice(0, -1) as any || [],
            context: [{ role: 'user', content: currentInput }] as any,
            sendChunk: (chunk) => {
                process.stdout.write(chunk.content);
                if (chunk.type !== 'chunk') {
                    console.log('\n非 chunk 类型:', chunk.type + '\n');
                }
                sendChunk(chunk);
                return Promise.resolve();
            },
        };

        this.handleGraphResponse(state, sendChunk);
    }

    private async handleGraphResponse(
        state: AgentExState,
        sendChunk: (chunk: IChaxStreamChunk) => void
    ): Promise<void> {
        try {
            const { result } = await graph.execute('nowadays', state);
            await result;

            sendChunk({
                type: 'done',
                content: ''
            });
        } catch (error) {
            console.error('Graph 执行错误:', error);
            sendChunk({
                type: 'error',
                content: error instanceof Error ? error.message : '未知错误'
            });
        }
    }
}

async function startServer() {
    console.log('=== 启动 GraphAgent Service ===');
    console.log(`SearXNG: ${SEARXNG_BASE_URL}`);

    const app = new Koa();
    app.use(cors());
    app.use(bodyParser());

    const chatCore = new GraphChatCore();

    const middleware = new CoreChaxKoaMiddleWare(
        chatCore,
        createLLM
    );

    app.use(middleware.createMiddleware());

    app.listen(PORT, () => {
        console.log('');
        console.log('='.repeat(60));
        console.log(`GraphAgent Service 已启动`);
        console.log('='.repeat(60));
        console.log(`监听端口: ${PORT}`);
        console.log(`SearXNG: ${SEARXNG_BASE_URL}`);
        console.log('');
        console.log('API 端点:');
        console.log('- GET  /health              - 健康检查');
        console.log('- POST /ai/chat             - 发送消息');
        console.log('- GET  /ai/record/list      - 获取会话列表');
        console.log('- GET  /ai/message/list/:id - 获取会话消息');
        console.log('');
        console.log('请求示例:');
        console.log(`curl -X POST http://localhost:${PORT}/ai/chat \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"message": "你的问题", "recordId": "会话ID"}'`);
        console.log('='.repeat(60));
    });
}

startServer().catch(console.error);
