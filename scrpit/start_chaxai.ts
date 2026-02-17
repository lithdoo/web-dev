import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(`🚀 启动 ChaxAI 服务，端口: ${PORT}`);
console.log('='.repeat(50));

const projectRoot = join(__dirname, '..');
const servicePath = join(projectRoot, 'packages', 'chaxai-agent', 'example', 'tool-group-reaxt-demo');

function startService() {
    return new Promise<void>((resolve, reject) => {
        console.log('\n📦 启动后端服务...');

        const serviceProcess = spawn('bun', [servicePath], {
            env: {
                ...process.env,
                SERVER_PORT: PORT.toString()
            },
            stdio: 'inherit'
        });

        serviceProcess.on('error', (error) => {
            console.error('❌ 后端服务启动失败:', error);
            reject(error);
        });

        serviceProcess.on('spawn', () => {
            console.log('✅ 后端服务已启动');
            setTimeout(resolve, 2000);
        });

        process.on('exit', () => {
            serviceProcess.kill();
        });
    });
}

function startClient() {
    console.log('\n🌐 启动前端开发服务器...');

    const clientProcess = spawn('bun', ['run', 'dev:example-server'], {
        cwd: join(projectRoot, 'packages', 'chaxai-client'),
        env: {
            ...process.env,
            VITE_SERVER_PORT: PORT.toString()
        },
        stdio: 'inherit'
    });

    clientProcess.on('error', (error) => {
        console.error('❌ 前端服务启动失败:', error);
    });

    clientProcess.on('spawn', () => {
        console.log('✅ 前端服务已启动');
        console.log(`\n🎉 启动完成！`);
        console.log(`   - 后端服务: http://localhost:${PORT}`);
        console.log(`   - 前端服务: http://localhost:3001`);
        console.log(`   - API 代理: http://localhost:3001/ai -> http://localhost:${PORT}`);
    });

    process.on('exit', () => {
        clientProcess.kill();
    });
}

async function main() {
    try {
        await startService();
        startClient();
    } catch (error) {
        console.error('启动失败:', error);
        process.exit(1);
    }
}

main();
