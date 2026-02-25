import { resolve } from "node:path";
import {
    BaseAgent,
    MCPSessionManager,
    createEvent,
    type Event,
    type InvocationContext,
    type StdioConnectionParams,
} from "@google/adk";

type FileMetadata = {
    name: string;
    path: string;
    sizeBytes?: number;
    createdAt?: string;
    modifiedAt?: string;
};

class FilesourceRuntime {
    private static readonly sourcePath = resolve(process.env.HOARDER_FILESOURCE_PATH ?? "D:/ai/adk/demofiles");

    private static readonly connectionParams: StdioConnectionParams = {
        type: "StdioConnectionParams",
        serverParams: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", FilesourceRuntime.sourcePath],
        },
    };

    private static readonly sessionManager = new MCPSessionManager(FilesourceRuntime.connectionParams);

    public static getSourcePath(): string {
        return FilesourceRuntime.sourcePath;
    }

    public static async listDirectory(path: string): Promise<unknown> {
        const client = await FilesourceRuntime.sessionManager.createSession();
        return client.callTool({
            name: "list_directory",
            arguments: { path },
        });
    }

    public static async getFileInfo(path: string): Promise<unknown> {
        const client = await FilesourceRuntime.sessionManager.createSession();
        return client.callTool({
            name: "get_file_info",
            arguments: { path },
        });
    }
}

function getResponseText(mcpResponse: unknown): string {
    const responseObject = mcpResponse as {
        content?: Array<{ text?: string }>;
        structuredContent?: { content?: string };
    };

    return responseObject?.structuredContent?.content ?? responseObject?.content?.[0]?.text ?? "";
}

function extractFileEntries(mcpResponse: unknown): string[] {
    const rawText = getResponseText(mcpResponse);

    const inlineMatches = [...rawText.matchAll(/\[FILE\]\s+([^\[]+)/g)]
        .map((match) => match[1].trim())
        .filter(Boolean);

    if (inlineMatches.length > 0) {
        return inlineMatches;
    }

    return rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("[FILE]"))
        .map((line) => line.replace(/^\[FILE\]\s*/, ""))
        .filter(Boolean);
}

function parseFileInfo(infoResponse: unknown, name: string, path: string): FileMetadata {
    const metadata: FileMetadata = { name, path };

    const responseObject = infoResponse as {
        structuredContent?: Record<string, unknown>;
    };

    const structured = responseObject?.structuredContent;
    if (structured && typeof structured === "object") {
        const size = structured.size ?? structured.fileSize ?? structured.length;
        const created = structured.createdAt ?? structured.created ?? structured.birthtime;
        const modified = structured.modifiedAt ?? structured.modified ?? structured.mtime;

        if (typeof size === "number") {
            metadata.sizeBytes = size;
        }
        if (typeof created === "string") {
            metadata.createdAt = created;
        }
        if (typeof modified === "string") {
            metadata.modifiedAt = modified;
        }
    }

    const text = getResponseText(infoResponse);

    if (metadata.sizeBytes === undefined) {
        const sizeMatch = text.match(/size[^\d]*(\d+)/i);
        if (sizeMatch) {
            metadata.sizeBytes = Number(sizeMatch[1]);
        }
    }

    if (!metadata.createdAt) {
        const createdMatch = text.match(/(?:created|creation date|birth time)\s*:?\s*([^\n]+)/i);
        if (createdMatch) {
            metadata.createdAt = createdMatch[1].trim();
        }
    }

    if (!metadata.modifiedAt) {
        const modifiedMatch = text.match(/(?:modified|last modified|mtime)\s*:?\s*([^\n]+)/i);
        if (modifiedMatch) {
            metadata.modifiedAt = modifiedMatch[1].trim();
        }
    }

    return metadata;
}

class FilesourceHoarderAgent extends BaseAgent {
    constructor() {
        super({
            name: "filesource_hoarder",
            description: "Custom hoarder agent that retrieves files and metadata from the filesystem MCP server.",
        });
    }

    protected async *runAsyncImpl(context: InvocationContext): AsyncGenerator<Event, void, void> {
        let outputText: string;

        try {
            const sourcePath = FilesourceRuntime.getSourcePath();
            const directoryResponse = await FilesourceRuntime.listDirectory(sourcePath);
            const files = extractFileEntries(directoryResponse);

            const fileMetadata: FileMetadata[] = [];
            for (const name of files) {
                const filePath = resolve(sourcePath, name);
                const infoResponse = await FilesourceRuntime.getFileInfo(filePath);
                fileMetadata.push(parseFileInfo(infoResponse, name, filePath));
            }

            context.session.state.file_list = JSON.stringify(fileMetadata);

            outputText = JSON.stringify(
                {
                    sourcePath,
                    fileCount: fileMetadata.length,
                    files: fileMetadata,
                },
                null,
                2,
            );
        } catch (error) {
            outputText = `Failed to list files or fetch metadata from filesystem MCP server: ${String(error)}`;
        }

        yield createEvent({
            invocationId: context.invocationId,
            author: this.name,
            content: {
                role: "model",
                parts: [{ text: outputText }],
            },
        });
    }

    protected async *runLiveImpl(context: InvocationContext): AsyncGenerator<Event, void, void> {
        yield* this.runAsyncImpl(context);
    }
}

export const filesourceAgent = new FilesourceHoarderAgent();
