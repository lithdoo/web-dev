import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatMessage } from '@langchain/core/messages';
// import { v4 as uuidv4 } from 'uuid';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from 'koa2-cors';
import { SimpleChatKoaMiddleWare } from '../src/SimpleChat';

/**
 * DeepSeek API 集成示例
 * 
 * 本示例展示了如何使用 LangChain 的 ChatDeepSeek 类直接与 DeepSeek API 进行交互。
 * 包括：
 * 1. 初始化 DeepSeek 聊天模型
 * 2. 发送单轮消息
 * 3. 发送多轮对话（包含历史消息）
 * 4. 使用流式响应
 */

// DeepSeek API 密钥
// 注意：在生产环境中，应使用环境变量存储密钥

/**
 * 示例 5: 启动 SimpleChatKoaMiddleWare 服务
 * 
 * 使用 SimpleChatKoaMiddleWare 启动一个基于 Koa 的 HTTP 服务，
 * 提供完整的聊天 API 端点。
 */
async function startServer() {
    console.log('=== 示例 5: 启动 SimpleChatKoaMiddleWare 服务 ===');

    // 设置环境变量，供 SimpleChatManager 使用
    // process.env.DEEPSEEK_API_KEY = DEEPSEEK_API_KEY;

    // 创建 Koa 应用实例
    const app = new Koa();

    // 使用 cors 中间件启用跨域访问
    app.use(cors());

    // 使用 bodyParser 中间件解析请求体
    app.use(bodyParser());

    // 设置服务端口
    const port = 3000;

    // 创建并使用 SimpleChatKoaMiddleWare
    // 可选：传入数据存储目录路径，默认为 .chaxai_data
    // const middleware = new SimpleChatKoaMiddleWare('./chat_data');
    const middleware = new SimpleChatKoaMiddleWare();

    // 将中间件添加到 Koa 应用
    app.use(middleware.createMiddleware());

    // 启动服务
    app.listen(port, () => {
        console.log(`DeepSeek Koa 服务已启动，监听端口 ${port}`);
        console.log('API 端点:');
        console.log('- GET /ai/record/list - 获取会话列表');
        console.log('- GET /ai/message/list/{conversationId} - 获取会话消息');
        console.log('- POST /ai/chat - 发送消息');
        console.log('- GET /ai/message/content/{msgId} - 获取消息内容');
        console.log('- GET /ai/message/stream/{msgId} - 流式获取消息');
        console.log('');
        console.log('服务已准备就绪，可以开始对话！');
        console.log('='.repeat(50));
    });
}

// 直接启动服务器
startServer().catch(error => {
    console.error('启动服务器时出错:', error);
    process.exit(1);
});