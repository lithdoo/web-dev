import { LLMGraphRouter } from '../src/runner/Router';
import { GraphAgent } from '../src/graph-agant';

const mockGraph: GraphAgent = {
    entries: ['start'],
    endPoints: ['end'],
    nodes: [
        { node: { label: 'start' }, keyname: 'start' },
        { node: { label: 'chat' }, keyname: 'chat' },
        { node: { label: 'search' }, keyname: 'search' },
        { node: { label: 'end' }, keyname: 'end' },
    ],
    edges: [
        { sourceKey: 'start', targetKey: 'chat', label: 'to chat', condition: { prompt: '用户想聊天' } },
        { sourceKey: 'start', targetKey: 'search', label: 'to search', condition: { prompt: '用户想搜索信息' } },
        { sourceKey: 'start', targetKey: 'end', label: 'to end' },
    ],
    execute: () => {},
    cancel: () => {},
    validate: () => true,
} as unknown as GraphAgent;

const mockLlm = {
    setMessages: function(this: any, messages: any[]) {
        const systemMessage = messages.find((m: any) => m.role === 'system');
        if (systemMessage) {
            console.log('\n' + '='.repeat(60));
            console.log('📋 LLM System Prompt:');
            console.log('='.repeat(60));
            console.log(systemMessage.content);
            console.log('='.repeat(60) + '\n');
        }
        return this;
    },
    bindTools: () => mockLlm,
    send: () => Promise.resolve({ content: 'search' }),
    steam: () => {},
};

const router = new LLMGraphRouter(mockGraph, { llm: mockLlm as any });

const state = {
    history: [
        { role: 'user', content: '请帮我分析这个问题' },
        { role: 'assistant', content: '分析节点：这是一个关于天气的问题，建议搜索最新天气信息' },
        { role: 'user', content: '那现在天气怎么样' },
    ],
    context: [
        { role: 'assistant', content: '搜索节点返回：今天天气晴朗，气温 25-30 度，微风' },
    ] as any,
    sendChunk: () => {},
};

console.log('\n' + '='.repeat(60));
console.log('🚀 测试 LLMGraphRouter 路由决策');
console.log('='.repeat(60));

const result = await router.next('start', state as any) ;

console.log('\n' + '='.repeat(60));
console.log(`✅ 最终决策: ${result}`);
console.log('='.repeat(60) + '\n');
