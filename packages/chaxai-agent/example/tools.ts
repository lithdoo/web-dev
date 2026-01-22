import { IAgxntTool } from '../src/interface';

export interface SearchConfig {
    timeout?: number;
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export async function parseSearxngHtml(html: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const resultRegex = /<div class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="[^"]*[^"]*"/g;
    const titleRegex = /<a[^>]+class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/;
    const urlRegex = /<a[^>]+class="[^"]*title[^"]*"[^>]+href="([^"]+)"/;
    const snippetRegex = /<p[^>]*class="[^"]*snippet[^"]*"[^>]*>([^<]+)<\/p>/;

    let match;
    while ((match = resultRegex.exec(html)) !== null) {
        const resultHtml = match[1];
        const titleMatch = resultHtml.match(titleRegex);
        const urlMatch = resultHtml.match(urlRegex);
        const snippetMatch = resultHtml.match(snippetRegex);

        if (titleMatch && urlMatch) {
            results.push({
                title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
                url: urlMatch[1],
                snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '',
            });
        }
    }

    return results;
}

export async function searchSearxng(query: string, baseUrl: string = 'https://opnxng.com', timeout: number = 30000): Promise<string> {
    const searchUrl = `${baseUrl}/?q=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html, */*',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return `搜索失败: HTTP ${response.status}`;
        }

        const html = await response.text();

        console.log('\n' + '='.repeat(60));
        console.log('SearXNG HTML Response:');
        console.log('='.repeat(60));
        console.log(html);
        console.log('='.repeat(60) + '\n');

        const results = await parseSearxngHtml(html);

        if (results.length === 0) {
            return `没有找到关于 "${query}" 的搜索结果`;
        }

        return results
            .slice(0, 5)
            .map(r => `[${r.title}](${r.url})\n${r.snippet}`)
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
    const timeout = config.timeout || 30000;

    return {
        info: {
            type: 'function',
            function: {
                name: 'search',
                description: '通过搜索引擎搜索互联网获取信息',
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
            const result = await searchSearxng(args.query, 'https://opnxng.com', timeout);
            console.log('[Search] 搜索结果长度:', result.length);
            return result;
        },
    };
}
