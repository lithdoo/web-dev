import { IAgxntTool } from "@/interface";

export interface ExecConfig {
    timeout?: number;
    workingDir?: string;
    encoding?: string;
    maxBuffer?: number;
}

export function createExecTool(config: ExecConfig = {}): IAgxntTool {
    const timeout = config.timeout || 60000;
    const workingDir = config.workingDir || process.cwd();
    const encoding = config.encoding || 'utf-8';
    const maxBuffer = config.maxBuffer || 1024 * 1024;

    return {
        info: {
            type: 'function',
            function: {
                name: 'exec',
                description: '执行 Shell 命令或脚本，windows 下默认使用 powershell.exe 执行;linux 下默认使用 /bin/bash 执行 , 执行脚本必须符合当前系统的脚本语法, 执行脚本必须符合当前系统的脚本语法, 执行脚本必须符合当前系统的脚本语法',
                parameters: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: '要执行的命令或脚本',
                        },
                        env: {
                            type: 'object',
                            additionalProperties: {
                                type: 'string',
                            },
                            description: '环境变量',
                        },
                        timeout: {
                            type: 'number',
                            description: '执行超时时间（毫秒），默认 60000',
                        },
                    },
                    required: ['command'],
                },
            },
        },
        async call(args: { 
            command: string;
            env?: Record<string, string>;
            timeout?: number 
        }) {
            console.log('[Exec] 执行命令:', args.command);
            console.log('[Exec] 工作目录:', workingDir);
            
            try {
                const { exec } = require('child_process');
                
                const execTimeout = args.timeout || timeout;
                
                return new Promise((resolve) => {
                    const child = exec(args.command, {
                        encoding: encoding,
                        timeout: execTimeout,
                        maxBuffer: maxBuffer,
                        cwd: workingDir,
                        env: {
                            ... (args.env || {}),
                        },
                        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
                    }, (error: any, stdout: string, stderr: string) => {
                        let output = '';
                        
                        if (stdout) {
                            output += `[STDOUT]\n${stdout}`;
                        }
                        
                        if (stderr) {
                            output += `\n[STDERR]\n${stderr}`;
                        }
                        
                        if (error) {
                            if (!output) {
                                output = `命令执行失败: ${error.message}`;
                            } else {
                                output = `命令执行失败 (退出码: ${error.code || '未知'})\n${output}`;
                            }
                            resolve(output);
                            return;
                        }
                        
                        if (!output.trim()) {
                            output = '命令执行成功，无输出';
                        }
                        
                        resolve(output);
                    });
                    
                    setTimeout(() => {
                        child.kill();
                        resolve(`命令执行超时 (${execTimeout}ms)，已终止`);
                    }, execTimeout);
                });
            } catch (error) {
                return `执行命令失败: ${error instanceof Error ? error.message : '未知错误'}`;
            }
        },
    };
}
