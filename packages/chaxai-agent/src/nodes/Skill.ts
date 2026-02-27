
import path from "path";
import { AgentNode, AgentExState } from "../graph-agant";
import { IAgxntLLM, IAgxntTool } from "../interface";
import matter from "gray-matter";
import { collectFiles, pathExists } from "../utils/skill-files";
import { CodeChunkSender } from "@/utils/chunk";

export interface SkillNodeConfig {
    dirPath: string;
    skillSelectionPrompt?: string;
    llm?: IAgxntLLM;
    metadata?: Record<string, unknown>;
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
    skillPrompt?: string | ((skills: AnthropicSkill[]) => string);
    metadata?: Record<string, unknown>;
}

export class AnthropicSkillNode implements AgentNode {

    static create(config: AnthropicSkillNodeConfig): Promise<AnthropicSkillNode> {
        return new AnthropicSkillNode(config).initialize();
    }

    label: string;
    metadata?: Record<string, unknown>;
    private skills: AnthropicSkill[];
    private dirPath: string;
    private skillPrompt: ((skills: AnthropicSkill[]) => string);

    constructor(config: AnthropicSkillNodeConfig) {
        this.label = config.label || config.name;
        this.metadata = config.metadata;
        this.skills = [];
        this.dirPath = config.dirPath;

        if (typeof config.skillPrompt === 'function') {
            this.skillPrompt = config.skillPrompt;
        } else if (typeof config.skillPrompt === 'string') {
            const prompt = config.skillPrompt
            this.skillPrompt = () => prompt;
        } else {
            this.skillPrompt = (skills) => `${this.createSkillPromptInfo(skills)}
你可以通过上面的 <available_skills> 列表访问一组专门的 Agent Skills。
- 每个 skill 只提供简要描述。
- 当用户请求与任意 skill 的描述（语义或关键词）匹配时，你**必须**使用文件读取工具读取对应路径的完整 SKILL.md 文件。
- **严禁**猜测或凭空想象 skill 内容 —— 决定使用前**必须先读取**实际文件。
- 读取后，**严格执行** SKILL.md 中的所有规则和指导。
- 支持同一轮中激活多个 skill。
- 无匹配时，不加载任何 skill，继续正常响应。 
- **特别注意** skill.md 文件中如果存在 $env:SKILL_DIR 环境变量，这个环境变量的值为 skill.md 文件所在目录，做相应操作前（比如读取文件或者执行脚本）**必须**进行替换。
            `;
        }
    }


    createSkillPromptInfo(skills: AnthropicSkill[]) {
        const skillInfo = skills.map(v => `
    <skill>
        <name>${v.name}</name>
        <description>${v.description}</description>
        <location>${v.path}/SKILL.md</location>
    </skill>`).join('')
        return `\n<available_skills>\n${skillInfo}\n</available_skills>\n`
    }

    async initialize(): Promise<this> {
        const { promises: fs } = await import('fs');
        const path = await import('path');

        if (!(await pathExists(this.dirPath))) {
            console.log(`[SkillNode] 目录不存在: ${this.dirPath}`);
            return this;
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
        return this
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
      
        const prompt = this.skillPrompt(this.skills);
        const skillsInfo = this.createSkillPromptInfo(this.skills);

        state.context.push({
            role: 'system',
            content: prompt,
        })
        new CodeChunkSender(state.sendChunk)
            .start('[json|技能信息]')
            .content(skillsInfo)
            .finish();

        return state;
    }


}

