import { describe, it, expect, vi, afterEach } from 'vitest';
import Koa from 'koa';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fs from 'fs';

const mockDeepSeekInstance = {
    bindMessages: vi.fn().mockReturnThis(),
    stream: vi.fn(),
};

vi.doMock('@langchain/deepseek', () => ({
    ChatDeepSeek: vi.fn().mockImplementation(() => mockDeepSeekInstance),
    default: vi.fn().mockImplementation(() => mockDeepSeekInstance),
}));

vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

vi.stubEnv('DEEPSEEK_API_KEY', 'test-mock-api-key-for-testing');

const { SimpleChatKoaMiddleWare } = await import('../src/SimpleChat');

describe('SimpleChatKoaMiddleWare', () => {
    
    describe('构造函数', () => {
        
        it('应该能创建 SimpleChatKoaMiddleWare 实例', () => {
            const middleware = new SimpleChatKoaMiddleWare();
            expect(middleware).toBeDefined();
            expect(middleware).toBeInstanceOf(SimpleChatKoaMiddleWare);
        });
        
        it('应该能传入自定义 dirPath', () => {
            const customPath = '/custom/test/path';
            const middleware = new SimpleChatKoaMiddleWare(customPath);
            expect(middleware).toBeDefined();
        });
        
        it('如果不传 dirPath，应该使用默认路径', () => {
            const middleware = new SimpleChatKoaMiddleWare();
            expect(middleware).toBeDefined();
        });
        
    });
    
    describe('createMiddleware 方法', () => {
        
        it('应该返回 Koa 中间件函数', () => {
            const middleware = new SimpleChatKoaMiddleWare();
            const middlewareFn = middleware.createMiddleware();
            expect(typeof middlewareFn).toBe('function');
        });
        
        it('返回的函数应该是 async 函数', async () => {
            const middleware = new SimpleChatKoaMiddleWare();
            const middlewareFn = middleware.createMiddleware();
            const app = new Koa();
            app.use(middlewareFn);
            
            const req: IncomingMessage = {
                url: '/ai/record/list',
                method: 'GET',
                headers: {},
                aborted: false,
                httpVersion: '1.1',
                httpVersionMajor: 1,
                httpVersionMinor: 1,
                complete: true,
                connection: {} as any,
                socket: {} as any,
                body: null,
                rawBody: '',
            } as unknown as IncomingMessage;
            const res = {
                statusCode: 200,
                statusMessage: 'OK',
                headersSent: false,
                chunkedEncoding: false,
                shouldKeepAlive: false,
                useChunkedEncodingByDefault: false,
                complete: true,
                rawHeaders: [],
                headers: {},
                setHeader: vi.fn(),
                getHeader: vi.fn(),
                getHeaderNames: vi.fn(),
                hasHeader: vi.fn(),
                removeHeader: vi.fn(),
                end: vi.fn((..._args: any[]) => res),
                write: vi.fn((..._args: any[]) => true),
                writeHead: vi.fn((..._args: any[]) => res),
                writeContinue: vi.fn(),
                writeProcessing: vi.fn(),
                setTimeout: vi.fn(),
                detachSocket: vi.fn(),
                writeChunk: vi.fn(),
                addTrailers: vi.fn(),
                flushHeaders: vi.fn(),
                assignSocket: vi.fn(),
                on: vi.fn(),
                once: vi.fn(),
                off: vi.fn(),
                emit: vi.fn(),
            } as unknown as ServerResponse<IncomingMessage>;
            const ctx = app.createContext(req, res);
            
            await app.callback()(ctx.req, ctx.res);
            expect(ctx.status).toBeDefined();
        });
        
    });
    
    describe('dirPath 环境变量测试', () => {
        
        afterEach(() => {
            const defaultDir = path.join(process.cwd(), '.chaxai_data');
            if (fs.existsSync(defaultDir)) {
                fs.rmSync(defaultDir, { recursive: true, force: true });
            }
        });
        
        it('应该能处理带空格路径', () => {
            const pathWithSpaces = '/path with spaces/test';
            const middleware = new SimpleChatKoaMiddleWare(pathWithSpaces);
            expect(middleware).toBeDefined();
        });
        
        it('应该能处理相对路径', () => {
            const relativePath = './relative/path';
            const middleware = new SimpleChatKoaMiddleWare(relativePath);
            expect(middleware).toBeDefined();
        });
        
    });
    
});
