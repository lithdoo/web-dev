import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSearxngTool } from '../example/tools';

describe('SearXNG Search Tool', () => {
    let fetchMock: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        fetchMock = vi.spyOn(globalThis, 'fetch');
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createSearxngTool', () => {
        it('should create a search tool with default config', () => {
            const tool = createSearxngTool();
            expect(tool).toBeDefined();
            expect(tool.info).toBeDefined();
            expect(tool.info.type).toBe('function');
            expect(tool.info.function.name).toBe('search');
            expect(tool.call).toBeDefined();
        });

        it('should create a search tool with custom baseUrl', () => {
            const tool = createSearxngTool({ baseUrl: 'https://searx.example.com' });
            expect(tool).toBeDefined();
        });

        it('should create a search tool with custom timeout', () => {
            const tool = createSearxngTool({ timeout: 60000 });
            expect(tool).toBeDefined();
        });
    });

    describe('search functionality', () => {
        it('should return formatted search results on success', async () => {
            const mockResults = {
                results: [
                    {
                        title: 'Test Result 1',
                        url: 'https://example.com/1',
                        content: 'This is test content 1',
                    },
                    {
                        title: 'Test Result 2',
                        url: 'https://example.com/2',
                        content: 'This is test content 2',
                    },
                ],
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResults),
            });

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'test query' });

            expect(result).toContain('Test Result 1');
            expect(result).toContain('https://example.com/1');
            expect(result).toContain('Test Result 2');
            expect(result).toContain('https://example.com/2');
            expect(consoleLogSpy).toHaveBeenCalledWith('[SearXNG] 搜索关键词:', 'test query');
            expect(consoleLogSpy).toHaveBeenCalledWith('[SearXNG] 搜索结果长度:', expect.any(Number));
        });

        it('should return "no results" message when results are empty', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: [] }),
            });

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'nonexistent query' });

            expect(result).toContain('没有找到');
            expect(result).toContain('nonexistent query');
        });

        it('should return "no results" message when response has no results field', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'empty response' });

            expect(result).toContain('没有找到');
            expect(result).toContain('empty response');
        });

        it('should return error message on HTTP error', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'test' });

            expect(result).toContain('搜索失败');
            expect(result).toContain('HTTP 500');
        });

        it('should handle timeout with AbortError', async () => {
            fetchMock.mockImplementationOnce(() => {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), 100);
                return Promise.reject(new Error('Aborted'));
            });

            const tool = createSearxngTool({ timeout: 50 });
            const result = await tool.call({ query: 'test' });

            expect(result).toContain('搜索超时');
        });

        it('should handle network errors', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'test' });

            expect(result).toContain('搜索失败');
            expect(result).toContain('Network error');
        });

        it('should handle unknown errors', async () => {
            fetchMock.mockRejectedValueOnce('Unknown error');

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'test' });

            expect(result).toContain('搜索失败');
            expect(result).toContain('未知错误');
        });

        it('should limit results to 5 items', async () => {
            const manyResults = {
                results: Array.from({ length: 10 }, (_, i) => ({
                    title: `Result ${i + 1}`,
                    url: `https://example.com/${i + 1}`,
                    content: `Content ${i + 1}`,
                })),
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(manyResults),
            });

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'many results' });

            const resultCount = (result.match(/Result \d+/g) || []).length;
            expect(resultCount).toBe(5);
        });

        it('should handle missing optional fields in results', async () => {
            const resultsWithMissingFields = {
                results: [
                    { title: 'Only Title', url: undefined, content: undefined },
                    { title: undefined, url: 'https://example.com', content: 'Only Content' },
                    {},
                ],
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(resultsWithMissingFields),
            });

            const tool = createSearxngTool();
            const result = await tool.call({ query: 'test' });

            expect(result).toContain('Only Title');
            expect(result).toContain('Only Content');
            expect(result).toContain('无标题');
        });
    });
});
