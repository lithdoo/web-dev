import { promises as fs } from 'fs';
import path from 'path';
import { IAgxntTool } from "@/interface";

export interface FileConfig {
    encoding?: BufferEncoding;
    maxFileSize?: number;
}

export function createReadFileTool(config: FileConfig = {}): IAgxntTool {
    const encoding = config.encoding || 'utf-8';
    const maxFileSize = config.maxFileSize || 1024 * 1024;

    return {
        info: {
            type: 'function',
            function: {
                name: 'readFile',
                description: '读取指定路径的文件内容',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: '要读取的文件路径（绝对路径或相对路径）',
                        },
                    },
                    required: ['filePath'],
                },
            },
        },
        async call(args: { filePath: string }) {
            console.log('[ReadFile] 读取文件:', args.filePath);
            
            try {
                const absolutePath = path.resolve(args.filePath);
                const stats = await fs.stat(absolutePath);
                
                if (stats.size > maxFileSize) {
                    return `文件太大 (${stats.size} bytes)，最大支持 ${maxFileSize} bytes`;
                }
                
                if (stats.isDirectory()) {
                    return `这是一个目录，不是文件: ${absolutePath}`;
                }
                
                const content = await fs.readFile(absolutePath, encoding);
                console.log('[ReadFile] 文件读取成功，大小:', content.length);
                return content;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'ENOENT') {
                        return `文件不存在: ${args.filePath}`;
                    }
                    if (fsError.code === 'EACCES') {
                        return `没有权限读取文件: ${args.filePath}`;
                    }
                }
                return `读取文件失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}

export interface DirectoryConfig {
    includeDetails?: boolean;
}

export function createReadDirectoryTool(config: DirectoryConfig = {}): IAgxntTool {
    const includeDetails = config.includeDetails !== false;

    return {
        info: {
            type: 'function',
            function: {
                name: 'readDirectory',
                description: '读取指定路径的目录内容（文件和子目录列表）',
                parameters: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            type: 'string',
                            description: '要读取的目录路径（绝对路径或相对路径）',
                        },
                    },
                    required: ['dirPath'],
                },
            },
        },
        async call(args: { dirPath: string }) {
            console.log('[ReadDirectory] 读取目录:', args.dirPath);
            
            try {
                const absolutePath = path.resolve(args.dirPath);
                const entries = await fs.readdir(absolutePath, { withFileTypes: true });
                
                if (entries.length === 0) {
                    return `目录为空: ${absolutePath}`;
                }
                
                const items = await Promise.all(
                    entries.map(async (entry) => {
                        if (includeDetails) {
                            const fullPath = path.join(absolutePath, entry.name);
                            const stats = await fs.stat(fullPath);
                            const type = entry.isDirectory() ? '目录' : '文件';
                            const size = stats.size;
                            const modified = stats.mtime.toISOString();
                            return `[${type}] ${entry.name} (${size} bytes, 修改于: ${modified})`;
                        }
                        return entry.isDirectory() ? `[目录] ${entry.name}` : `[文件] ${entry.name}`;
                    })
                );
                
                const result = `目录: ${absolutePath}\n\n${items.join('\n')}`;
                console.log('[ReadDirectory] 目录读取成功，项目数:', items.length);
                return result;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'ENOENT') {
                        return `目录不存在: ${args.dirPath}`;
                    }
                    if (fsError.code === 'ENOTDIR') {
                        return `这不是一个目录: ${args.dirPath}`;
                    }
                    if (fsError.code === 'EACCES') {
                        return `没有权限访问目录: ${args.dirPath}`;
                    }
                }
                return `读取目录失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}
