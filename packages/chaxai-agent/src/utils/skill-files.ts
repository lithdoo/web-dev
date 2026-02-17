export async function collectFiles(dirPath: string): Promise<string[]> {
    const { promises: fs } = await import('fs');
    const pathModule = await import('path');

    const files: string[] = [];

    async function scanDirectory(currentPath: string): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = pathModule.join(currentPath, entry.name);
            if (entry.isFile()) {
                files.push(fullPath);
            } else if (entry.isDirectory()) {
                await scanDirectory(fullPath);
            }
        }
    }

    await scanDirectory(dirPath);
    return files;
}

export async function pathExists(filePath: string): Promise<boolean> {
    const { promises: fs } = await import('fs');
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}
