import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMGraphRouter } from '../src/runner/Router';
import { GraphAgent, AgentExState } from '../src/graph-agant';
import { IAgxntLLM } from '../src/interface';

describe('LLMGraphRouter', () => {
    let mockGraph: GraphAgent;
    let mockLlm: IAgxntLLM;
    let consoleLogSpy: any;

    beforeEach(() => {
        mockGraph = {
            entries: ['start'],
            endPoints: ['end', 'final'],
            nodes: [
                { node: { label: 'start' }, keyname: 'start' },
                { node: { label: 'chat' }, keyname: 'chat' },
                { node: { label: 'search' }, keyname: 'search' },
                { node: { label: 'analyze' }, keyname: 'analyze' },
                { node: { label: 'end' }, keyname: 'end' },
                { node: { label: 'final' }, keyname: 'final' },
            ],
            edges: [
                { sourceKey: 'start', targetKey: 'chat', label: 'to chat', condition: { prompt: '用户想聊天' } },
                { sourceKey: 'start', targetKey: 'search', label: 'to search', condition: { prompt: '用户想搜索信息' } },
                { sourceKey: 'start', targetKey: 'analyze', label: 'to analyze', condition: { prompt: '用户需要分析' } },
                { sourceKey: 'start', targetKey: 'end', label: 'to end' },
                { sourceKey: 'chat', targetKey: 'end', label: 'to end' },
                { sourceKey: 'search', targetKey: 'end', label: 'to end' },
            ],
            execute: vi.fn(),
            cancel: vi.fn(),
            validate: vi.fn(),
        } as unknown as GraphAgent;

        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        mockLlm = {
            setMessages: vi.fn().mockImplementation(function(this: any, messages: any[]) {
                const systemMessage = messages.find((m: any) => m.role === 'system');
                if (systemMessage) {
                    console.log('\n' + '='.repeat(60));
                    console.log('LLM System Prompt:');
                    console.log('='.repeat(60));
                    console.log(systemMessage.content);
                    console.log('='.repeat(60) + '\n');
                }
                return this;
            }),
            bindTools: vi.fn().mockReturnThis(),
            send: vi.fn().mockResolvedValue({ content: '' }),
            steam: vi.fn(),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create router with default LLM', () => {
            const router = new LLMGraphRouter(mockGraph);
            expect(router).toBeDefined();
        });

        it('should create router with custom LLM', () => {
            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            expect(router).toBeDefined();
        });

        it('should create router with custom system prompt', () => {
            const customPrompt = 'Custom prompt';
            const router = new LLMGraphRouter(mockGraph, { systemPrompt: customPrompt });
            expect(router).toBeDefined();
        });

        it('should use DeepseekLLM by default', () => {
            const router = new LLMGraphRouter(mockGraph);
            expect(router).toBeDefined();
        });
    });

    describe('next - 终点判断', () => {
        it('should return END when no edges from current node', async () => {
            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('hello');

            const result = await router.next('end', state);
            expect(result).toBe('END');
        });

        it('should return END when current node is in endPoints', async () => {
            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('hello');

            const result = await router.next('final', state);
            expect(result).toBe('END');
        });

        it('should return END when node has no outgoing edges', async () => {
            const isolatedGraph: GraphAgent = {
                ...mockGraph,
                edges: [{ sourceKey: 'other', targetKey: 'end', label: 'test' }],
            } as unknown as GraphAgent;

            const router = new LLMGraphRouter(isolatedGraph, { llm: mockLlm });
            const state = createMockState('hello');

            const result = await router.next('start', state);
            expect(result).toBe('END');
        });
    });

    describe('next - LLM 调用', () => {
        it('should call LLM with correct messages', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('我想聊天');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ role: 'system' }),
                    expect.objectContaining({ role: 'user' }),
                ])
            );
            expect(mockLlm.send).toHaveBeenCalled();
        });

        it('should include system prompt with route descriptions', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('我想聊天');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('chat'),
                    }),
                ])
            );
        });

        it('should include user request in messages', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'search' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('搜索今天的新闻');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ role: 'user', content: '请根据以上信息，选择下一个应该跳转的节点。' }),
                ])
            );
        });
    });

    describe('next - 路由决策', () => {
        it('should return valid target key from LLM response', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('我想聊天');

            const result = await router.next('start', state);
            expect(result).toBe('chat');
        });

        it('should return search when LLM chooses search', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'search' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('搜索天气');

            const result = await router.next('start', state);
            expect(result).toBe('search');
        });

        it('should return default edge when LLM returns invalid key', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'invalid_node' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('hello');

            const result = await router.next('start', state);
            expect(result).toBe('end');
        });

        it('should return first edge when no default edge and invalid LLM response', async () => {
            const graphWithoutDefault: GraphAgent = {
                ...mockGraph,
                edges: [
                    { sourceKey: 'start', targetKey: 'chat', label: 'to chat', condition: { prompt: '用户想聊天' } },
                    { sourceKey: 'start', targetKey: 'search', label: 'to search', condition: { prompt: '用户想搜索' } },
                ],
            } as unknown as GraphAgent;

            (mockLlm.send as any).mockResolvedValue({ content: 'invalid' });

            const router = new LLMGraphRouter(graphWithoutDefault, { llm: mockLlm });
            const state = createMockState('hello');

            const result = await router.next('start', state);
            expect(result).toBe('chat');
        });

        it('should handle response with whitespace', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: '  search  ' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('查找资料');

            const result = await router.next('start', state);
            expect(result).toBe('search');
        });

        it('should handle empty response content', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: '' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('hello');

            const result = await router.next('start', state);
            expect(result).toBe('end');
        });
    });

    describe('next - 上下文处理', () => {
        it('should handle empty context and history', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [],
                context: [],
                sendChunk: vi.fn(),
            };

            const result = await router.next('start', state);
            expect(result).toBe('chat');
        });

        it('should handle LLM response with undefined content', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: undefined });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [
                    { role: 'user', content: '用户之前的问题' },
                    { role: 'assistant', content: 'AI 之前的回答' },
                ],
                context: [],
                sendChunk: vi.fn(),
            };

            const result = await router.next('start', state);
            expect(result).toBe('end');
        });

        it('should include all context messages in prompt', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [
                    { role: 'user', content: '用户之前的问题' },
                ],
                context: [
                    { role: 'assistant', content: '分析节点的分析结果' },
                    { role: 'assistant', content: '搜索节点返回的信息' },
                ] as any,
                sendChunk: vi.fn(),
            };

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('分析节点的分析结果'),
                    }),
                ])
            );
        });

        it('should include context role information in prompt', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [
                    { role: 'user', content: '用户输入' },
                ],
                context: [
                    { role: 'assistant', content: 'LLM 节点的输出结果' },
                ] as any,
                sendChunk: vi.fn(),
            };

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('[assistant]'),
                    }),
                ])
            );
        });

        it('should handle context with missing role', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [],
                context: [
                    { content: '只有内容' },
                ] as any,
                sendChunk: vi.fn(),
            };

            const result = await router.next('start', state);
            expect(result).toBe('chat');
        });

        it('should handle context with missing content', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [],
                context: [
                    { role: 'assistant', content: undefined },
                ] as any,
                sendChunk: vi.fn(),
            };

            const result = await router.next('start', state);
            expect(result).toBe('chat');
        });

        it('should show all context messages from other LLM nodes', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'search' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [
                    { role: 'user', content: '请帮我分析这个问题' },
                    { role: 'assistant', content: '分析结果：这是一个关于天气的问题' },
                    { role: 'user', content: '那现在天气怎么样' },
                ],
                context: [
                    { role: 'assistant', content: '搜索节点结果：今天天气晴朗，25度' },
                ] as any,
                sendChunk: vi.fn(),
            };

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('搜索节点结果'),
                    }),
                ])
            );
        });
    });

    describe('next - 历史记录压缩', () => {
        it('should include history in prompt', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [
                    { role: 'user', content: '之前的问题' },
                    { role: 'assistant', content: '之前的回答' },
                ],
                context: [],
                sendChunk: vi.fn(),
            };

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('历史对话摘要'),
                    }),
                ])
            );
        });

        it('should handle long history by compressing it', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: Array(10).fill(null).map((_, i) => ({
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `历史消息 ${i + 1}`.repeat(50),
                })),
                context: [{ role: 'user', content: '当前请求' }] as any,
                sendChunk: vi.fn(),
            };

            await router.next('start', state);

            expect(mockLlm.send).toHaveBeenCalled();
        });

        it('should indicate no history when history is empty', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [],
                context: [{ role: 'user', content: '当前请求' }] as any,
                sendChunk: vi.fn(),
            };

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('[无历史对话]'),
                    }),
                ])
            );
        });
    });

    describe('next - 路由规则展示', () => {
        it('should include route descriptions in prompt', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('测试');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('1. 目标节点: chat'),
                    }),
                ])
            );
        });

        it('should include edge labels in route descriptions', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'search' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('搜索');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('to search'),
                    }),
                ])
            );
        });

        it('should include edge conditions in route descriptions', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('聊天');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('用户想聊天'),
                    }),
                ])
            );
        });

        it('should indicate no conditions when edge has no condition', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'end' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('结束');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('无条件'),
                    }),
                ])
            );
        });

        it('should include current node in prompt', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('测试');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('**当前节点**: start'),
                    }),
                ])
            );
        });
    });

    describe('next - 路由决策结果展示', () => {
        it('should show routing decision result in console', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('测试');

            const result = await router.next('start', state);

            expect(result).toBe('chat');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('路由决策结果:')
            );
        });

        it('should show END when at end node', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('测试');

            const result = await router.next('end', state);

            expect(result).toBe('END');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('路由决策结果: END')
            );
        });
    });

    describe('next - 自定义配置', () => {
        it('should use custom system prompt when provided', async () => {
            const customPrompt = '自定义提示词';
            const router = new LLMGraphRouter(mockGraph, {
                llm: mockLlm,
                systemPrompt: customPrompt,
            });

            (mockLlm.send as any).mockResolvedValue({ content: 'chat' });
            const state = createMockState('测试');

            await router.next('start', state);

            expect(mockLlm.setMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining(customPrompt),
                    }),
                ])
            );
        });

        it('should use custom LLM when provided', async () => {
            const customLlm = {
                setMessages: vi.fn().mockReturnThis(),
                bindTools: vi.fn().mockReturnThis(),
                send: vi.fn().mockResolvedValue({ content: 'chat' }),
                steam: vi.fn(),
            };

            const router = new LLMGraphRouter(mockGraph, { llm: customLlm as any });
            const state = createMockState('测试');

            const result = await router.next('start', state);

            expect(customLlm.setMessages).toHaveBeenCalled();
            expect(customLlm.send).toHaveBeenCalled();
            expect(result).toBe('chat');
        });
    });

    describe('next - 复杂场景', () => {
        it('should handle graph with multiple edges from same node', async () => {
            const complexGraph: GraphAgent = {
                ...mockGraph,
                edges: [
                    { sourceKey: 'start', targetKey: 'chat', label: 'to chat', condition: { prompt: '聊天' } },
                    { sourceKey: 'start', targetKey: 'search', label: 'to search', condition: { prompt: '搜索' } },
                    { sourceKey: 'start', targetKey: 'analyze', label: 'to analyze', condition: { prompt: '分析' } },
                    { sourceKey: 'start', targetKey: 'end', label: 'to end' },
                ],
            } as unknown as GraphAgent;

            (mockLlm.send as any).mockResolvedValue({ content: 'analyze' });

            const router = new LLMGraphRouter(complexGraph, { llm: mockLlm });
            const state = createMockState('分析这个问题');

            const result = await router.next('start', state);
            expect(result).toBe('analyze');
        });

        it('should continue to next node after routing decision', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'end' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state = createMockState('结束对话');

            const result = await router.next('chat', state);
            expect(result).toBe('end');
        });

        it('should handle state with both context and history', async () => {
            (mockLlm.send as any).mockResolvedValue({ content: 'search' });

            const router = new LLMGraphRouter(mockGraph, { llm: mockLlm });
            const state: AgentExState = {
                history: [
                    { role: 'user', content: '之前的问题' },
                    { role: 'assistant', content: '之前的回答' },
                ],
                context: [
                    { role: 'user', content: '现在想搜索' },
                ] as any,
                sendChunk: vi.fn(),
            };

            const result = await router.next('start', state);
            expect(result).toBe('search');
        });
    });
});

function createMockState(lastInput: string): AgentExState {
    return {
        history: [
            { role: 'user', content: '用户的历史问题' },
            { role: 'assistant', content: 'AI 的历史回答' },
        ],
        context: [
            { role: 'assistant', content: `当前节点的处理结果: ${lastInput}` },
        ] as any,
        sendChunk: vi.fn(),
    };
}
