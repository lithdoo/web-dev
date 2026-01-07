import { ChatDeepSeek } from '@langchain/deepseek';
import { Tool } from '@langchain/core/tools';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { formatLogToString } from 'langchain/agents/format_scratchpad';
import { AgentActionOutputParser } from '@langchain/core/agents';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ReadFileTool - 用于读取文件内容的工具类
 * 
 * 提供安全的文件读取功能，包括：
 * - 绝对路径解析
 * - 文件存在检查
 * - 文件类型限制（防止读取危险文件）
 */
class ReadFileTool extends Tool {
  name = 'read_file';
  description = '读取指定路径的文件内容。当你需要查看文件内容来回答问题时使用此工具。';
  
  /**
   * 允许读取的文件扩展名列表
   */
  private allowedExtensions = [
    '.txt', '.js', '.ts', '.json', '.md', '.html', '.css',
    '.yaml', '.yml', '.xml', '.csv', '.log'
  ];
  
  /**
   * 执行文件读取操作
   * @param filePath 文件路径
   * @returns 文件内容或错误信息
   */
  async _call(filePath: string): Promise<string> {
    try {
      // 解析绝对路径
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(process.cwd(), filePath);
      
      // 检查文件是否存在
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        return `错误：${filePath} 不是一个文件。`;
      }
      
      // 检查文件扩展名
      const ext = path.extname(absolutePath).toLowerCase();
      if (!this.allowedExtensions.includes(ext)) {
        return `错误：不允许读取 ${ext} 类型的文件。`;
      }
      
      // 读取文件内容
      const content = await fs.readFile(absolutePath, 'utf-8');
      return `文件 ${filePath} 的内容：\n\n${content}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `错误：文件 ${filePath} 不存在。`;
      }
      return `错误：读取文件时发生错误 - ${(error as Error).message}`;
    }
  }
}

/**
 * 初始化 DeepSeek LLM 实例
 */
const initDeepSeek = () => {
  const DEEPSEEK_API_KEY = 'sk-5069284b93a7481db08a15f65628906a';
  
  return new ChatDeepSeek({
    model: 'deepseek-chat',
    apiKey: DEEPSEEK_API_KEY,
    temperature: 0.7,
  });
};

/**
 * 创建并配置 Agent
 * @returns 配置好的 AgentExecutor
 */
const createAgent = () => {
  // 初始化 LLM
  const llm = initDeepSeek();
  
  // 创建工具
  const tools = [new ReadFileTool()];
  
  // 创建提示模板
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个智能助手，具有读取文件的能力。
      你可以使用工具来帮助回答问题。
      请根据用户的问题决定是否需要使用工具，以及如何使用工具。
      如果使用工具，你将看到工具的输出，然后可以继续回答用户的问题。
      请始终以自然、友好的方式回答用户的问题。
      `
    ],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}']
  ]);
  
  // 创建 Agent
  const agent = createToolCallingAgent(llm, tools, prompt);
  
  // 创建 Agent Executor
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    verbose: true, // 启用详细日志，展示思考过程
  });
  
  return agentExecutor;
};

/**
 * 示例：使用 Agent 读取文件
 */
const runExample = async () => {
  console.log('=== 示例：使用 Agent 读取 package.json 文件 ===');
  
  const agentExecutor = createAgent();
  
  try {
    const result = await agentExecutor.invoke({
      input: '请帮我读取项目根目录下的 package.json 文件，并告诉我项目的名称和版本号。'
    });
    
    console.log('\nAgent 回答：');
    console.log(result.output);
  } catch (error) {
    console.error('执行错误：', error);
  }
};

/**
 * 交互式模式：用户可以输入问题
 */
const runInteractive = async () => {
  console.log('=== 交互式 Agent 模式 ===');
  console.log('你可以输入问题，Agent 会使用文件读取工具来帮助回答。');
  console.log('输入 "exit" 或 "quit" 退出。');
  
  const agentExecutor = createAgent();
  
  // 由于在非交互式环境中，我们使用简单的输入方式
  // 在实际交互式环境中，可以使用 readline 模块
  const testQuestions = [
    '请读取 src/SimpleChat.ts 文件，告诉我它的主要功能是什么。',
    '请查看 package.json 文件，列出项目的依赖。'
  ];
  
  for (const question of testQuestions) {
    console.log('\n用户：', question);
    
    try {
      const result = await agentExecutor.invoke({
        input: question
      });
      
      console.log('\nAgent 回答：');
      console.log(result.output);
    } catch (error) {
      console.error('执行错误：', error);
    }
  }
};

/**
 * 主函数：运行示例或交互式模式
 */
const main = async () => {
  // 运行示例
  await runExample();
  
  // 运行交互式模式
  console.log('\n\n' + '='.repeat(50));
  await runInteractive();
};

// 执行主函数
main().catch(error => {
  console.error('程序执行错误：', error);
  process.exit(1);
});
