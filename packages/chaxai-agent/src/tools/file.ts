import { promises as fs } from 'fs';
import path from 'path';
import { IAgxntTool } from "@/interface";

export interface CommonToolConfig {
    roots: string[];
}

export interface FileConfig extends CommonToolConfig {
    encoding?: BufferEncoding;
    maxFileSize?: number;
}

export interface DirectoryConfig extends CommonToolConfig {
    includeDetails?: boolean;
}

function validatePath(targetPath: string, rootPaths: string[]): { valid: boolean; absolutePath: string; error?: string } {
    if (!path.isAbsolute(targetPath)) {
        return { valid: false, absolutePath: targetPath, error: `请使用绝对路径，而非相对路径: ${targetPath}` };
    }

    const absoluteTargetPath = path.resolve(targetPath);

    const isInRoots = rootPaths.some(root => {
        const absoluteRootPath = path.resolve(root);
        return absoluteTargetPath.startsWith(absoluteRootPath);
    });

    if (!isInRoots) {
        return { valid: false, absolutePath: absoluteTargetPath, error: `路径超出允许的根目录: ${targetPath} (允许的根目录: ${rootPaths.join(', ')})` };
    }

    return { valid: true, absolutePath: absoluteTargetPath };
}

export function createReadFileTool(config: FileConfig): IAgxntTool {
    const encoding = config.encoding || 'utf-8';
    const maxFileSize = config.maxFileSize || 1024 * 1024;
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'readFile',
                description: `读取指定路径的文件内容，超过 ${(maxFileSize / 1024 / 1024).toFixed(0)}MB 的文件无法读取，目录无法读取（根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: `要读取的文件路径（必须在 ${root} 目录下）`,
                        },
                    },
                    required: ['filePath'],
                },
            },
        },
        async call(args: { filePath: string }) {
            console.log('[ReadFile] 读取文件:', args.filePath);

            const validation = validatePath(args.filePath, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                const stats = await fs.stat(validation.absolutePath);

                if (stats.size > maxFileSize) {
                    return `文件太大 (${stats.size} bytes)，最大支持 ${maxFileSize} bytes`;
                }

                if (stats.isDirectory()) {
                    return `这是一个目录，不是文件: ${validation.absolutePath}`;
                }

                const content = await fs.readFile(validation.absolutePath, encoding);
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

export function createReadDirectoryTool(config: DirectoryConfig): IAgxntTool {
    const includeDetails = config.includeDetails !== false;
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'readDirectory',
                description: `读取指定路径的目录内容（根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            type: 'string',
                            description: `要读取的目录路径（必须在 ${root} 目录下）`,
                        },
                    },
                    required: ['dirPath'],
                },
            },
        },
        async call(args: { dirPath: string }) {
            console.log('[ReadDirectory] 读取目录:', args.dirPath);

            const validation = validatePath(args.dirPath, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                const entries = await fs.readdir(validation.absolutePath, { withFileTypes: true });

                if (entries.length === 0) {
                    return `目录为空: ${validation.absolutePath}`;
                }

                const items = await Promise.all(
                    entries.map(async (entry) => {
                        if (includeDetails) {
                            const fullPath = path.join(validation.absolutePath, entry.name);
                            const stats = await fs.stat(fullPath);
                            const type = entry.isDirectory() ? '目录' : '文件';
                            const size = stats.size;
                            const modified = stats.mtime.toISOString();
                            return `[${type}] ${entry.name} (${size} bytes, 修改于: ${modified})`;
                        }
                        return entry.isDirectory() ? `[目录] ${entry.name}` : `[文件] ${entry.name}`;
                    })
                );

                const result = `目录: ${validation.absolutePath} 中存在以下内容：\n\n${items.join('\n')}`;
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

export function createReadStatTool(config: CommonToolConfig): IAgxntTool {
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'readStat',
                description: `读取文件或目录的详细信息（同时支持文件和目录，包含大小、创建时间、修改时间、类型等，根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: `要查询的文件或目录路径（必须在 ${root} 目录下）`,
                        },
                    },
                    required: ['path'],
                },
            },
        },
        async call(args: { path: string }) {
            console.log('[ReadStat] 查询路径:', args.path);

            const validation = validatePath(args.path, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                const stats = await fs.stat(validation.absolutePath);
                const isFile = stats.isFile();
                const isDirectory = stats.isDirectory();
                const type = isFile ? '文件' : isDirectory ? '目录' : '未知';

                const result = [
                    `路径: ${validation.absolutePath}`,
                    `类型: ${type}`,
                    `大小: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`,
                    `创建时间: ${stats.birthtime.toISOString()}`,
                    `修改时间: ${stats.mtime.toISOString()}`,
                    `访问时间: ${stats.atime.toISOString()}`,
                    `权限: ${stats.mode.toString(8)}`,
                ].join('\n');

                console.log('[ReadStat] 查询成功:', validation.absolutePath);
                return result;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'ENOENT') {
                        return `路径不存在: ${args.path}`;
                    }
                    if (fsError.code === 'EACCES') {
                        return `没有权限访问: ${args.path}`;
                    }
                }
                return `查询失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}

export function createRemoveDirectoryTool(config: CommonToolConfig): IAgxntTool {
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'removeDirectory',
                description: `递归删除指定路径的目录及其所有内容，如果目标不是目录则报错（根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            type: 'string',
                            description: `要删除的目录路径（必须在 ${root} 目录下）`,
                        },
                    },
                    required: ['dirPath'],
                },
            },
        },
        async call(args: { dirPath: string }) {
            console.log('[RemoveDirectory] 删除目录:', args.dirPath);

            const validation = validatePath(args.dirPath, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                const stats = await fs.stat(validation.absolutePath);

                if (!stats.isDirectory()) {
                    return `这不是一个目录: ${validation.absolutePath}`;
                }

                await fs.rm(validation.absolutePath, { recursive: true, force: true });
                console.log('[RemoveDirectory] 目录删除成功:', validation.absolutePath);
                return `目录已删除: ${validation.absolutePath}`;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'ENOENT') {
                        return `目录不存在: ${args.dirPath}`;
                    }
                    if (fsError.code === 'EACCES') {
                        return `没有权限删除目录: ${args.dirPath}`;
                    }
                    if (fsError.code === 'EBUSY') {
                        return `目录正在被使用，无法删除: ${args.dirPath}`;
                    }
                }
                return `删除目录失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}

export function createCreateDirectoryTool(config: CommonToolConfig): IAgxntTool {
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'createDirectory',
                description: `递归创建指定路径的目录（根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            type: 'string',
                            description: `要创建的目录路径（必须在 ${root} 目录下）`,
                        },
                    },
                    required: ['dirPath'],
                },
            },
        },
        async call(args: { dirPath: string }) {
            console.log('[CreateDirectory] 创建目录:', args.dirPath);

            const validation = validatePath(args.dirPath, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                await fs.mkdir(validation.absolutePath, { recursive: true });
                console.log('[CreateDirectory] 目录创建成功:', validation.absolutePath);
                return `目录已创建: ${validation.absolutePath}`;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'EACCES') {
                        return `没有权限创建目录: ${args.dirPath}`;
                    }
                    if (fsError.code === 'ENOTDIR') {
                        return `路径中的某个组件不是目录: ${args.dirPath}`;
                    }
                }
                return `创建目录失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}

export interface WriteFileConfig extends CommonToolConfig {
    encoding?: BufferEncoding;
}

export function createWriteFileTool(config: WriteFileConfig): IAgxntTool {
    const encoding = config.encoding || 'utf-8';
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'writeFile',
                description: `写入内容到文件（如果文件不存在则创建，如果父目录不存在则递归创建，如果文件存在则覆盖原内容，根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: `要写入的文件路径（必须在 ${root} 目录下）`,
                        },
                        content: {
                            type: 'string',
                            description: '要写入的文件内容',
                        },
                    },
                    required: ['filePath', 'content'],
                },
            },
        },
        async call(args: { filePath: string; content: string }) {
            console.log('[WriteFile] 写入文件:', args.filePath);

            const validation = validatePath(args.filePath, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                const dirPath = path.dirname(validation.absolutePath);
                await fs.mkdir(dirPath, { recursive: true });

                await fs.writeFile(validation.absolutePath, args.content, encoding);
                console.log('[WriteFile] 文件写入成功:', validation.absolutePath);
                return `文件已写入: ${validation.absolutePath}`;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'EACCES') {
                        return `没有权限写入文件: ${args.filePath}`;
                    }
                    if (fsError.code === 'EISDIR') {
                        return `这是一个目录，不是文件: ${args.filePath}`;
                    }
                }
                return `写入文件失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}

export function createDeleteFileTool(config: CommonToolConfig): IAgxntTool {
    const root = config.roots;

    return {
        info: {
            type: 'function',
            function: {
                name: 'deleteFile',
                description: `删除指定文件，如果文件不存在则报错，无法删除目录（根目录: ${root.join(', ')}）`,
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: `要删除的文件路径（必须在 ${root} 目录下）`,
                        },
                    },
                    required: ['filePath'],
                },
            },
        },
        async call(args: { filePath: string }) {
            console.log('[DeleteFile] 删除文件:', args.filePath);

            const validation = validatePath(args.filePath, root);
            if (!validation.valid) {
                return validation.error!;
            }

            try {
                const stats = await fs.stat(validation.absolutePath);

                if (stats.isDirectory()) {
                    return `这是一个目录，不是文件: ${validation.absolutePath}`;
                }

                await fs.unlink(validation.absolutePath);
                console.log('[DeleteFile] 文件删除成功:', validation.absolutePath);
                return `文件已删除: ${validation.absolutePath}`;
            } catch (error) {
                if (error instanceof Error && 'code' in error) {
                    const fsError = error as { code?: string };
                    if (fsError.code === 'ENOENT') {
                        return `文件不存在: ${args.filePath}`;
                    }
                    if (fsError.code === 'EACCES') {
                        return `没有权限删除文件: ${args.filePath}`;
                    }
                }
                return `删除文件失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}
