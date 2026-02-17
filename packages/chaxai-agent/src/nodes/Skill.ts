
import path from "path";
import { AgentNode, AgentExState } from "../graph-agant";
import { IAgxntLLM, IAgxntTool } from "../interface";
import matter from "gray-matter";
import { collectFiles, pathExists } from "../utils/skill-files";
import { NativeToolReActNode } from "./NativeTool";

export interface SkillNodeConfig {
    dirPath: string;
    skillSelectionPrompt?: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface ParameterSchema {
    type?: ParameterType;
    description?: string;
    required?: boolean;
    enum?: string[];
    default?: unknown;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    items?: ParameterSchema;
    properties?: Record<string, ParameterSchema>;
    additionalProperties?: boolean;
}

export interface AnthropicSkillManifest {
    name: string;
    description: string;
    instructions?: string;
}


export interface AnthropicSkill extends AnthropicSkillManifest {
    path: string;
    referenceFiles?: string[];
    scriptFiles?: string[];
}

export interface AnthropicSkillNodeConfig {
    name: string;
    label?: string;
    description?: string;
    dirPath: string;
    skillSelectionPrompt?: string | ((skills: AnthropicSkill[]) => string);
    llm?: IAgxntLLM;
    maxIterations?: number;
    metadata?: Record<string, unknown>;
}

export class AnthropicSkillNode implements AgentNode {

    static create(config: AnthropicSkillNodeConfig): AnthropicSkillNode {
        return new AnthropicSkillNode(config);
    }

    label: string;
    metadata?: Record<string, unknown>;
    private llm: IAgxntLLM;
    private skills: AnthropicSkill[];
    private maxIterations: number;
    private dirPath: string;

    constructor(config: AnthropicSkillNodeConfig) {
        if (!config.llm) {
            throw new Error('AnthropicSkillNode requires an LLM instance');
        }
        this.llm = config.llm
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.maxIterations = config.maxIterations || 5;
        this.skills = [];
        this.dirPath = config.dirPath;
    }

    async initialize(): Promise<void> {
        const { promises: fs } = await import('fs');
        const path = await import('path');

        if (!(await pathExists(this.dirPath))) {
            console.log(`[SkillNode] 目录不存在: ${this.dirPath}`);
            return;
        }

        const entries = await fs.readdir(this.dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = path.join(this.dirPath, entry.name);
                const skillMdPath = path.join(skillPath, 'SKILL.md');

                if (await pathExists(skillMdPath)) {
                    try {
                        const manifest = await this.readManifest(entry.name);
                        if (manifest) {
                            const files = await this.readFiles(skillPath);
                            this.skills.push({
                                ...manifest,
                                path: skillPath,
                                referenceFiles: files.referenceFiles,
                                scriptFiles: files.scriptFiles,
                            });
                        }
                    } catch (error) {
                        console.error(`[SkillNode] 加载 skill 失败: ${skillPath}`, error);
                    }
                }
            }
        }

        console.log(`[SkillNode] 加载了 ${this.skills.length} 个 skills`);
    }

    private async readManifest(name: string): Promise<AnthropicSkillManifest | null> {
        const skillPath = path.join(this.dirPath, name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');

        if (!(await pathExists(skillMdPath))) {
            console.warn(`[SkillNode] SKILL.md 不存在: ${skillMdPath}`);
            return null;
        }

        const { promises: fs } = await import('fs');

        try {
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const result = matter(content);
            const frontmatter = result.data;
            const instructions = result.content.trim();

            if (!frontmatter.name || !frontmatter.description) {
                console.warn(`[SkillNode] SKILL.md frontmatter 缺少必填字段 (name/description): ${skillMdPath}`);
                return null;
            }

            return {
                name: String(frontmatter.name),
                description: String(frontmatter.description),
                instructions: instructions,
            };
        } catch (error) {
            console.error(`[SkillNode] 解析 SKILL.md 失败: ${skillMdPath}`, error);
            return null;
        }
    }

    private async readFiles(skillPath: string): Promise<{
        referenceFiles: string[];
        scriptFiles: string[];
    }> {
        const referenceFiles: string[] = [];
        const scriptFiles: string[] = [];

        const referencesPath = path.join(skillPath, 'references');
        if (await pathExists(referencesPath)) {
            const files = await collectFiles(referencesPath);
            referenceFiles.push(...files.map(f => path.relative(skillPath, f)));
        }

        const scriptsPath = path.join(skillPath, 'scripts');
        if (await pathExists(scriptsPath)) {
            const files = await collectFiles(scriptsPath);
            scriptFiles.push(...files.map(f => path.relative(skillPath, f)));
        }

        return { referenceFiles, scriptFiles };
    }

    async execute(state: AgentExState): Promise<AgentExState> {
        if (this.skills.length === 0) {
            await this.initialize();
        }

        let iterations = 0;

        while (iterations < this.maxIterations) {
            iterations++;

            const decision = await this.think(state);
            if (!decision.shouldUseSkill) {
                break;
            }

            if (decision.skillName && decision.arguments) {
                await this.act(state, decision.skillName, decision.arguments);
            }
        }

        return state;
    }

    private async think(state: AgentExState): Promise<{
        shouldUseSkill: boolean;
        skillName?: string;
        arguments?: Record<string, any>;
        finalAnswer?: string;
    }> {
        const messages = this.buildThinkMessages(state);
        this.llm.setMessages(messages);

        const response = await this.llm.send(state.sendChunk);
        const result = this.parseThinkResponse(response.content || '');

        state.context.push({
            role: 'assistant',
            content: `[思考] ${result.thought}`,
        });

        if (!result.shouldUseSkill) {
            state.context.push({
                role: 'assistant',
                content: result.finalAnswer || '',
            });
        }

        return result;
    }

    private async act(state: AgentExState, skillName: string, args: Record<string, any>): Promise<void> {
        const skill = this.skills.find(s => s.name === skillName);
        if (!skill) {
            state.context.push({
                role: 'assistant',
                content: `Skill "${skillName}" 未找到。可用 skills: ${this.skills.map(s => s.name).join(', ')}`,
            });
            return;
        }

        let skillResult: string;
        try {
            skillResult = await this.executeSkill(skill, args);
        } catch (error) {
            skillResult = `Skill 执行错误: ${error instanceof Error ? error.message : '未知错误'}`;
        }

        state.context.push({
            role: 'assistant',
            content: `[skill: ${skillName}]\n${skillResult}`,
        });
    }

    private async executeSkill(skill: AnthropicSkill, args: Record<string, any>): Promise<string> {

        return `[Skill: ${skill.name}]\n执行结果`;
    }





    private buildThinkMessages(state: AgentExState): { role: string; content: string }[] {
        const messages: { role: string; content: string }[] = [];

        const historyContent = state.history.map(m => `[${m.role}] ${m.content}`).join('\n');
        const contextContent = state.context.map(m => `[${m.role}] ${m.content}`).join('\n');

        const promptContent = this.buildThinkPrompt();

        messages.push({
            role: 'system',
            content: `${promptContent}

## 可用 Skills
\`\`\`json
${JSON.stringify(this.skills.map(s => ({
                name: s.name,
                description: s.description,
            })), null, 2)}
\`\`\`

## 历史对话
${historyContent}

## 当前上下文
${contextContent}`,
        });

        const lastUserMessage = [...state.history, ...state.context]
            .reverse()
            .find(m => m.role === 'user');

        if (lastUserMessage) {
            messages.push({
                role: 'user',
                content: lastUserMessage.content,
            });
        }

        return messages;
    }

    private buildThinkPrompt(): string {
        const skillsJson = JSON.stringify(this.skills.map(s => ({
            name: s.name,
            description: s.description,
        })), null, 2);

        return `你是一个智能助手，需要通过选择和执行 Skill 来解决问题。

## 可用 Skills
\`\`\`json
${skillsJson}
\`\`\`

## 任务
1. 分析当前状态，判断是否需要调用 Skill
2. 如果需要调用 Skill，选择最合适的 Skill 并生成参数
3. 如果不需要 Skill，直接给出回答

请以 JSON 格式返回：
\`\`\`json
{
    "thought": "你的思考过程",
    "shouldUseSkill": true 或 false,
    "skillName": "Skill 名称（如果需要调用）",
    "arguments": {}（如果需要调用）
}
\`\`\``;
    }

    private parseThinkResponse(content: string): {
        thought: string;
        shouldUseSkill: boolean;
        skillName?: string;
        arguments?: Record<string, any>;
        finalAnswer?: string;
    } {
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonContent = jsonMatch ? jsonMatch[1] : content;
            const parsed = JSON.parse(jsonContent);

            return {
                thought: parsed.thought || '',
                shouldUseSkill: parsed.shouldUseSkill === true,
                skillName: parsed.skillName,
                arguments: parsed.arguments,
                finalAnswer: parsed.finalAnswer,
            };
        } catch {
            return {
                thought: `解析失败: ${content.slice(0, 100)}`,
                shouldUseSkill: false,
            };
        }
    }
}


export class SkillExecutorNode implements AgentNode {



    toolNode: NativeToolReActNode;

    constructor(
        private skill: AnthropicSkill,
        private llm: IAgxntLLM,
        private tools: IAgxntTool[],
    ) {

        const toolGroupNode = new NativeToolReActNode({
            name: skill.name,
            label: skill.name,
            description: skill.description,
            tools: this.tools,
            observePrompt: (tools) => {
                const toolsJson = JSON.stringify(tools.map(t => t.info), null, 2);
                const skill = this.skill

                return `你是一个智能助手，需要通过思考和工具调用来解决问题。

## 技能说明
${skill.description}

## 技能指令
${skill.instructions || '无'}

## 可用工具
\`\`\`json
${toolsJson}
\`\`\`

## 任务
根据上述技能说明和指令，选择合适的工具来完成任务。

请以 JSON 格式返回：
\`\`\`json
{
    "thought": "你的思考过程",
    "shouldCallTool": true 或 false,
    "toolName": "工具名称（如果需要调用）",
    "arguments": {}（如果需要调用）
}
\`\`\``;
            },
        });
        this.toolNode = toolGroupNode;
    }


    async execute(state: AgentExState): Promise<AgentExState> {
        return this.toolNode.execute(state);
    }


    async executeTool(state: AgentExState): Promise<AgentExState> {
        return this.toolNode.execute(state);
    }

}