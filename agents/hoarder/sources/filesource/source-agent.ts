import { LlmAgent, MCPToolset, MCPSessionManager } from "@google/adk";
import type { StdioConnectionParams } from "@google/adk";
import type { SourceConfig } from "../../config.ts";

type SourceAgentOptions = {
    name: string;
    description: string;
    sourceLabel: string;
    source: SourceConfig;
};

const sourceToolsets = new Map<string, MCPToolset>();
const sourceSessionManagers = new Map<string, MCPSessionManager>();

function createSourceConnectionParams(sourceFolder: string): StdioConnectionParams {
    return {
        type: "StdioConnectionParams",
        serverParams: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", sourceFolder],
        },
    };
}

function ensureSourceRuntime(source: SourceConfig): { toolset: MCPToolset; manager: MCPSessionManager } {
    let toolset = sourceToolsets.get(source.id);
    let manager = sourceSessionManagers.get(source.id);

    if (!toolset || !manager) {
        const params = createSourceConnectionParams(source.path);
        toolset = new MCPToolset(params, ["list_directory", "read_file"]);
        manager = new MCPSessionManager(params);
        sourceToolsets.set(source.id, toolset);
        sourceSessionManagers.set(source.id, manager);
    }

    return { toolset, manager };
}

export function createFileSystemHoarderAgent(options: SourceAgentOptions): LlmAgent {
    const { toolset } = ensureSourceRuntime(options.source);

    return new LlmAgent({
        name: options.name,
        model: "gemini-2.5-flash",
        description: options.description,
        tools: [toolset],
        instruction: `You are the ${options.sourceLabel} document hoarder.
Scan and ingest only from ${options.source.path}.
Never include drafts.
Prefer /Final/ or /Approved/ path hints and status values Released/Frozen.
For each candidate document, produce metadata and an auditable decision.`,
    });
}

export async function getToolsForSource(sourceId: string) {
    const toolset = sourceToolsets.get(sourceId);
    if (!toolset) {
        throw new Error(`Unknown source or source not enabled: ${sourceId}`);
    }
    return toolset.getTools();
}

export async function readFileListFromSource(sourceId: string, directoryPath: string): Promise<unknown> {
    const manager = sourceSessionManagers.get(sourceId);
    if (!manager) {
        throw new Error(`Unknown source or source not enabled: ${sourceId}`);
    }

    const client = await manager.createSession();
    return client.callTool({
        name: "list_directory",
        arguments: { path: directoryPath },
    });
}


