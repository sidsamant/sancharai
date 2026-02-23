import { resolve } from "node:path";
import { LlmAgent, MCPToolset, MCPSessionManager } from "@google/adk";
import type { StdioConnectionParams } from "@google/adk";

class FilesourceRuntime {
    private static readonly sourceId = "filesystem";
    private static readonly sourcePath = resolve(process.env.HOARDER_FILESOURCE_PATH ?? "./docs");

    private static readonly connectionParams: StdioConnectionParams = {
        type: "StdioConnectionParams",
        serverParams: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", FilesourceRuntime.sourcePath],
        },
    };

    private static readonly toolset = new MCPToolset(FilesourceRuntime.connectionParams, [
        "list_directory"
    ]);

    private static readonly sessionManager = new MCPSessionManager(FilesourceRuntime.connectionParams);

    public static getToolset(): MCPToolset {
        return FilesourceRuntime.toolset;
    }

    public static getSourcePath(): string {
        return FilesourceRuntime.sourcePath;
    }

    private static assertSource(sourceId: string): void {
        if (sourceId !== FilesourceRuntime.sourceId) {
            throw new Error(`Unknown source or source not enabled: ${sourceId}`);
        }
    }

    public static async getToolsForSource(sourceId: string) {
        FilesourceRuntime.assertSource(sourceId);
        return FilesourceRuntime.toolset.getTools();
    }

    public static async readFileListFromSource(sourceId: string, directoryPath: string): Promise<unknown> {
        FilesourceRuntime.assertSource(sourceId);

        const client = await FilesourceRuntime.sessionManager.createSession();
        return client.callTool({
            name: "list_directory",
            arguments: { path: directoryPath },
        });
    }
}

export const filesourceAgent = new LlmAgent({
    name: "filesource_hoarder",
    model: "gemini-2.5-flash",
    description: "Hoarder sub-agent for filesystem-backed document sources.",
    tools: [FilesourceRuntime.getToolset()],
    instruction: `You are a Data Classifier.
Scan and ingest only from ${FilesourceRuntime.getSourcePath()}.
Never include drafts.
Inspect directory metadata first. DO notretrieve file content.
Use directory structure and file metadata to determine final/released signals for each document.
If a document is not final/released, reject it with an explicit reason.
For each candidate document, produce metadata and an auditable decision for ingestion.
The coordinator agent will handle reading document content for those approved for ingestion.`,
});


// export async function getToolsForSource(sourceId: string) {
//     return FilesourceRuntime.getToolsForSource(sourceId);
// }

// export async function readFileListFromSource(sourceId: string, directoryPath: string): Promise<unknown> {
//     return FilesourceRuntime.readFileListFromSource(sourceId, directoryPath);
// }
