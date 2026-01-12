import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';

// 创建工具实例
const tool = new DuckDuckGoSearch({ maxResults: 5 });

// 打印工具的name属性
console.log('DuckDuckGoSearch工具的name属性:', tool.name);
