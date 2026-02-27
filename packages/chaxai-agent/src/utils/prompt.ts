import { AgentExState } from "@/graph-agant";
import { IAgxntTool } from "@/interface";

export type BuildPromptFunc<T> = string | ((tools: T) => string);

export const defaultPrompt: BuildPromptFunc<IAgxntTool[]> = (tools) => `你是一个工具助手，请根据用户需求选择合适的工具。

## 可用工具
${tools.map(t =>
    `- ${t.info.function.name}: ${t.info.function.description}`
).join('\n')}

## 规则
1. 仔细阅读用户需求，选择最合适的工具
2. 如果不需要调用工具，返回空字符串
3. 确保参数正确
4. 如果最近的思考内容中包含了工具调用，则严格按照思考中的工具调用进行返回，不要擅自修改内容（比如最近思考内容是创建目录，则不要擅自改为读取目录），并且需要验证工具调用的参数是否正确。
            `.trim()

export const buildToolPrompt = (
    tools: () => IAgxntTool[],
    prompt?: BuildPromptFunc<IAgxntTool[]>,
) => {
    if (typeof prompt === 'function') {
        return prompt(tools());
    } else if (typeof prompt === 'string') {
        return prompt
    } else if (typeof defaultPrompt === 'function') {
        return defaultPrompt(tools());
    } else if (defaultPrompt) {
        return defaultPrompt;
    }

    throw new Error('NativeToolReActNode requires a prompt function or string');
}

export const buildStateMessage = (
    state: AgentExState,
    prompt: string
) => {
    const userMessage = [...state.history].reverse().find(m => m.role === 'user');
    const historyMessages = state.history.filter(m => m !== userMessage);
    const contextContent = state.context.map(m => `[${m.title ?? m.role}] ${m.content}`).join('\n');
    const systemMessage = {
        role: 'system',
        content: `
用户提的问题是：${userMessage?.content || ''}
-------------------------------------------
目前对话的上下文如下\n${contextContent}\n
-------------------------------------------
你**必须**根据用户提的问题和并结合当前上下文进行之后的所有思考和决策。

${prompt}
            `
    }

    return [...historyMessages, systemMessage]
}