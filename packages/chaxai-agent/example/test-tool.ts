import { createSearchTool } from './tools';

const args = process.argv.slice(2);
const query = args.join(' ') || '人工智能最新发展';

if (query === '--help' || query === '-h') {
    console.log('用法: bun run test-tool.ts <搜索关键词>');
    console.log('示例: bun run test-tool.ts 人工智能最新发展');
    process.exit(0);
}

async function main() {
    console.log('='.repeat(60));
    console.log('SearXNG 搜索测试 (localhost:8080)');
    console.log('='.repeat(60));
    console.log(`搜索关键词: ${query}`);
    console.log('-'.repeat(60));

    const searchTool = createSearchTool({
        baseUrl: 'http://localhost:8080',
        timeout: 30000,
    });

    const startTime = Date.now();
    const result = await searchTool.call({ query });
    const elapsed = Date.now() - startTime;

    console.log(`耗时: ${elapsed}ms`);
    console.log('-'.repeat(60));
    console.log('搜索结果:');
    console.log(result);
    console.log('='.repeat(60));
}

main().catch(console.error);
