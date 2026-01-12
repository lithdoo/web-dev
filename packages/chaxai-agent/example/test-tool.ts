import { createDeepseekLLM } from "../src/deepseek";
import { readFileTool, readFile } from "../src/tool";

(async () => {
    try {
        const llm = createDeepseekLLM();
        llm.bindTools([readFileTool]);
        llm.registerToolHandler("read_file", (args) => {
            return readFile(args.path);
        });

        llm.setMessages([
            { role: "user", content: "请读取文件 C:\\Users\\lithd\\Documents\\trae_projects\\webc-file-view\\packages\\chaxai-service\\example\\diy-agent\\interface.ts 的内容" }
        ]);

        console.log("=== 测试文件读取工具 ===\n");
        const result = await llm.steam((chunk) => {
            if (chunk.type === 'chunk') {
                process.stdout.write(chunk.content);
            }
        });
        console.log("\n最终结果:", result);
    } catch (error) {
        console.error("错误:", error);
    }
})();
