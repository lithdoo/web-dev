import { type IChaxService, ChaxApiPath, type IChaxStreamChunk } from "@chaxai-common";
import type { Context, Next } from "koa";

/**
 * ChaxKoaMiddleWare - Koa 中间件，将 ChaxAI 服务封装为 HTTP API
 * 
 * 职责：
 * - 将 IChaxService 的方法映射到 HTTP API 端点
 * - 处理请求参数解析和响应格式化
 * - 支持流式响应 (Server-Sent Events)
 * 
 * API 端点映射：
 * - GET  /ai/record/list           → onFetchChatConversations()
 * - GET  /ai/message/list/:recordId → onFetchChatMessages(recordId)
 * - POST /ai/chat                  → onSendChatMessage(content, recordId)
 * - GET  /ai/message/content/:msgId → onFetchContentMessage(msgId)
 * - GET  /ai/message/stream/:msgId → onFetchStreamMessage(msgId, onChunk)
 */
export class ChaxKoaMiddleWare {
    constructor(
        protected readonly chaxService: IChaxService,
    ) {
    }

    /**
     * 创建 Koa 中间件函数
     * 
     * @returns Koa 中间件函数，可用于 app.use()
     */
    createMiddleware(): (ctx: Context, next: Next) => Promise<void> {
        return this.handle.bind(this);
    }

    /**
     * Koa 中间件入口
     * 
     * 路由分发逻辑：
     * 1. 根据请求方法和路径匹配对应的 API 端点
     * 2. 解析请求参数
     * 3. 调用对应的 IChaxService 方法
     * 4. 处理响应，支持普通响应和流式响应
     */
    async handle(ctx: Context, next: Next): Promise<void> {
        const { method, path } = ctx;

        try {
            if (method === 'GET' && path === ChaxApiPath.fetchChatRecords.path) {
                ctx.body = await this.chaxService.onFetchChatConversations();
                return;
            }

            if (method === 'GET') {
                const messageListMatch = path.match(/^\/ai\/message\/list\/([^/]+)$/);
                if (messageListMatch) {
                    const conversationId = messageListMatch[1];
                    ctx.body = await this.chaxService.onFetchChatMessages(conversationId);
                    return;
                }

                const contentMatch = path.match(/^\/ai\/message\/content\/([^/]+)$/);
                if (contentMatch) {
                    const msgId = contentMatch[1];
                    ctx.body = await this.chaxService.onFetchContentMessage(msgId);
                    return;
                }

                const streamMatch = path.match(/^\/ai\/message\/stream\/([^/]+)$/);
                if (streamMatch) {
                    const msgId = streamMatch[1];
                    await this.handleStreamResponse(ctx, msgId);
                    return;
                }
            }

            if (method === 'POST' && path === ChaxApiPath.sendChatMessage.path) {
                const body = (ctx.request as any).body as Record<string, any>;
                const { recordId, content } = body;
                if (!content) {
                    ctx.status = 400;
                    ctx.body = { error: 'content is required' };
                    return;
                }
                ctx.body = await this.chaxService.onSendChatMessage(content, recordId);
                return;
            }

            await next();
        } catch (error) {
            ctx.status = 500;
            ctx.body = {
                error: error instanceof Error ? error.message : 'Internal server error',
            };
        }
    }

    /**
     * 处理流式响应
     * 
     * 使用 Server-Sent Events (SSE) 协议推送流式数据：
     * 1. 设置响应头为 text/event-stream
     * 2. 禁用缓存和连接超时
     * 3. 将 onChunk 回调接收的数据格式化为 SSE 事件
     * 4. 完成后关闭连接
     * 
     * SSE 格式：
     * - data: {"type":"chunk","content":"..."}\n\n
     * - event: [type]\n
     */
    private async handleStreamResponse(ctx: Context, msgId: string): Promise<void> {
        ctx.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        ctx.status = 200;

        const sendEvent = (chunk: IChaxStreamChunk): void => {
            ctx.res.write(`event: ${chunk.type}\n`);
            ctx.res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        };

        try {
            await this.chaxService.onFetchStreamMessage(msgId, sendEvent);

            sendEvent({
                type: 'done',
                content: '',
            });
        } catch (error) {
            sendEvent({
                type: 'error',
                content: error instanceof Error ? error.message : 'Stream error',
            });
        } finally {
            ctx.res.end();
        }
    }
}
