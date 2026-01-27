import { IAgxntTool } from '../src/interface';

export interface SearchConfig {
    baseUrl?: string;
    timeout?: number;
}

export interface SearxngResponse {
    results?: Array<{
        title?: string;
        url?: string;
        content?: string;
    }>;
}

export async function searchSearxng(query: string, baseUrl: string = 'http://localhost:8080', timeout: number = 30000): Promise<string> {
    const searchUrl = `${baseUrl}/?q=${encodeURIComponent(query)}&format=json`;

    console.log('[Search] 请求 URL:', searchUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return `搜索失败: HTTP ${response.status}`;
        }

        const data = await response.json() as SearxngResponse;

        if (!data.results || data.results.length === 0) {
            return `没有找到关于 "${query}" 的搜索结果`;
        }

        return data.results
            .slice(0, 5)
            .map(r => `[${r.title || '无标题'}](${r.url || ''})\n${r.content || ''}`)
            .join('\n\n');
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))) {
            return '搜索超时，请稍后再试';
        }
        return `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
}

export function createSearchTool(config: SearchConfig = {}): IAgxntTool {
    const baseUrl = config.baseUrl || 'http://localhost:8000';
    const timeout = config.timeout || 30000;

    return {
        info: {
            type: 'function',
            function: {
                name: 'search',
                description: '通过 SearXNG 搜索引擎搜索互联网获取信息',
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
            console.log('[Search] 搜索关键词:', args.query);
            const result = await searchSearxng(args.query, baseUrl, timeout);
            console.log('[Search] 搜索结果长度:', result.length);
            return result;
        },
    };
}
