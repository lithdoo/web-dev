import { DeepseekLLM } from "@/deepseek";
import { AgentNode, AgentExState } from "@/graph-agant";
import { IAgxntLLM, IAgxntTool } from "@/interface";
import { NativeToolGroupNode } from "./NativeTool";
import { buildStateMessage, buildToolPrompt } from "@/utils/prompt";
import { CodeChunkSender } from "@/utils/chunk";

export interface NativeToolReActNodeConfig {
    name: string;
    label?: string;
    description?: string;
    tools: IAgxntTool[];
    // observePrompt?: string | ((tools: IAgxntTool[]) => string);
    // callPrompt?: string | ((tools: IAgxntTool[]) => string);
    llmCall?: IAgxntLLM;
    llmObserve?: IAgxntLLM;
    maxIterations?: number;
    metadata?: Record<string, unknown>;
}
export class NativeToolReActNode implements AgentNode {

    static create(config: NativeToolReActNodeConfig): NativeToolReActNode {
        return new NativeToolReActNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    private groupNode: NativeToolGroupNode;
    private maxIterations: number;
    private thinkLLM: IAgxntLLM;

    get tools() {
        return this.config.tools;
    }

    constructor(private config: NativeToolReActNodeConfig) {
        if (!config.llmCall) {
            throw new Error('NativeToolReActNode requires an LLM instance');
        }
        if (!config.tools || config.tools.length === 0) {
            throw new Error('NativeToolReActNode requires at least one tool');
        }

        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.maxIterations = config.maxIterations || 5;

        const callPrompt = buildToolPrompt(  ()=>this.tools);


        console.log(this.tools)
        this.groupNode = new NativeToolGroupNode({
            name: `${config.name}_group`,
            tools: config.tools,
            systemPrompt: callPrompt,
            llm: new DeepseekLLM(null, 0, "required"),
        });
        this.thinkLLM = config.llmObserve ?? new DeepseekLLM();
    }


    async execute(state: AgentExState): Promise<AgentExState> {
        let iterations = 0;

        while (iterations < this.maxIterations) {
            iterations++;

            const shouldCall = await this.think(state);
            if (!shouldCall) {
                break;
            } else {
                await this.groupNode.execute(state);
            }
        }

        return state;
    }

    private async think(state: AgentExState): Promise<boolean> {
        const messages = buildStateMessage(
            state, `
你是一个智能助手，负责分析用户需求并决定是否需要调用工具来完成任务。

## 可用工具
\`\`\`json
${JSON.stringify(this.tools.map(t => t.info), null, 2)}
\`\`\`

## 决策规则
1. 仔细分析用户的问题和需求
2. 判断是否有合适的工具可以帮你回答或解决问题
3. 如果有多个可用工具，选择最合适的一个
4. 如果不需要工具，直接返回空字符串

## 输出要求
- **需要工具时**：请回复需要哪些工具，以及为什么需要这些工具。
- **不需要工具时**：直接返回空字符串

## 特别注意
1. 你**必须**根据用户提的问题和并结合当前上下文，完成思考内容并判断是否需要调用工具。
2. 如果已存在工具调用结果，则需要根据结果判断是否继续调用工具（例如，如果脚本执行失败，则需要根据错误消息评估调整脚本或者将错误报告给用户）
            `.trim());
        this.thinkLLM.setMessages(messages);

        const response = await this.thinkLLM.send(() => { });
        const shouldCall = !!response.content?.trim();

        if (shouldCall) {
            state.context.push({
                role: 'assistant',
                content: `[思考] ${response}`,
                title: '深度思考内容'
            });
            new CodeChunkSender(state.sendChunk)
                .start('[md|深度思考内容]')
                .content(response.content?.trim() || '无思考内容')
                .finish();
        } else {
            state.sendChunk({
                type: 'chunk', content: `\n[工具调用评估] 工具调用完毕。\n`
            });
            new CodeChunkSender(state.sendChunk)
                .start('[md|深度思考内容]')
                .content('工具调用完毕。')
                .finish();
        }

        return shouldCall


        // const response = await this.groupNode.llm.send();
        // const result = await this.groupNode.parseResponse(response, state);

        // return result;
    }

}
