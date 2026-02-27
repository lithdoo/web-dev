import { CodeChunkSender } from '@/utils/chunk';
import { AgentNode, AgentExState } from '../graph-agant';



export interface NowadaysNodeConfig {
    name: string;
    label?: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export class NowadaysNode implements AgentNode {

    static create(config: NowadaysNodeConfig) {
        return new NowadaysNode(config);
    }
    label: string;
    metadata?: Record<string, unknown>;

    constructor(config: NowadaysNodeConfig) {
        this.label = config.label || config.name;
        this.metadata = config.metadata;
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const now = new Date();
        const timeInfo = `当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 
当前系统信息: ${JSON.stringify(process.platform)} ${JSON.stringify(process.arch)} ${JSON.stringify(process.version)}
当前对话语言: ${JSON.stringify(process.env.LANG?? 'zh-CN')};
回复对话**必须** 根据当前对话语言进行回复，在执行 Shell 命令或脚本时，**必须** 根据当前系统选择合适的脚本语法。
        `;

        state.context.push({
            role: 'system',
            content: timeInfo,
        });

        new CodeChunkSender(state.sendChunk)
            .start('[pre|环境信息]')
            .content(timeInfo.trim())
            .finish();

        return state;
    }
}
