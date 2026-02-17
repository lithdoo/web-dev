import { IChaxStreamChunk } from "@chaxai-common";

export class CodeChunkSender {
    constructor(public readonly sendChunk: (chunk: IChaxStreamChunk) => void) { }

    finish() {
        this.sendChunk({
            type: 'chunk',
            content: '\n``````\n',
        });
        return this
    }

    start(type: string) {
        this.sendChunk({
            type: 'chunk',
            content: `\n\`\`\`\`\`\`${type}\n`,
        });

        return this
    }

    content(content: string) {
        this.sendChunk({
            type: 'chunk',
            content,
        });
        return this
    }
}