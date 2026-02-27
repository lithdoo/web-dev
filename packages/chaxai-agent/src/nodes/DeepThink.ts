import { AgentExState } from "@/graph-agant";
import { BaseLLMNode, LLMAgentNodeConfig } from "./BaseLLM";
import { CodeChunkSender } from "@/utils/chunk";

const DEFAULT_DEEP_THINK_PROMPT = `## 角色
你是深度思考助手，负责对问题进行深入、全面、严谨的分析。

## 任务要求
1. 仔细分析用户提出的问题，理解问题的本质和深层含义
2. 从多个角度进行思考，包括：背景分析、关键因素、潜在影响、替代方案等
3. 提供结构化的推理过程，展示思考的逻辑链条
4. 在给出结论前，考虑可能的反例和边界情况
5. 保持客观中立，避免先入为主的判断
6. 不要直接回答问题，仅仅只是对问题的分析和归纳

## 输出格式
请直接输出你的思考内容，不要包含任何代码块标记（如 \`\`\`thinking 或 \`\`\`）。`;

export interface DeepThinkNodeConfig extends Omit<LLMAgentNodeConfig, 'systemPrompt'> {
    thinkPrompt?: string;
    systemPrompt?: string;
}


export class DeepThinkNode extends BaseLLMNode {

    static create(config: DeepThinkNodeConfig): DeepThinkNode {
        return new DeepThinkNode(config);
    }

    constructor(config: DeepThinkNodeConfig) {
        const systemPrompt = config.systemPrompt || DEFAULT_DEEP_THINK_PROMPT;
        super({
            ...config,
            systemPrompt,
            label: config.label || config.name,
        });
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        const messages = await this.buildMessages(state);

        const sender = new CodeChunkSender(state.sendChunk);
        this.llm.setMessages(messages);

        sender.start('[md|预先思考]');

        const response = await this.llm.send(sender.sendChunk);

        sender.finish()

        const content = response.content || '';

        state.context.push({
            role: 'assistant',
            content: `【深度思考结果】${content}`,
        });

        return state;
    }
}