import "dotenv/config";
import { LlmAgent } from "@google/adk";
import { loadHoarderConfig } from "./config";
import { createConfluenceHoarderAgent } from "./sources/confluence/agent";
import { createFilesourceHoarderAgent } from "./sources/filesource/agent";
import { createGdocsHoarderAgent } from "./sources/gdocs/agent";
import { createSharepointHoarderAgent } from "./sources/sharepoint/agent";
import { createSlackHoarderAgent } from "./sources/slack/agent";
import { createWhatsappHoarderAgent } from "./sources/whatsapp/agent";
import type { SourceConfig } from "./config";
import { getToolsForSource, readFileListFromSource } from "./source-agent";

export { createMetadata, evaluateDocumentForIngestion } from "./policy";
export type { HoarderAuditRecord, HoarderDecision, HoarderMetadata } from "./policy";
export { getToolsForSource, readFileListFromSource };

type SourceAgentFactory = (source: SourceConfig) => LlmAgent;

const FACTORIES: Record<string, SourceAgentFactory> = {
    filesource: createFilesourceHoarderAgent,
    filesystem: createFilesourceHoarderAgent,
    confluence: createConfluenceHoarderAgent,
    gdocs: createGdocsHoarderAgent,
    sharepoint: createSharepointHoarderAgent,
    slack: createSlackHoarderAgent,
    whatsapp: createWhatsappHoarderAgent,
};

const config = loadHoarderConfig();
const enabledSources = config.sources.filter((source) => source.enabled);

const sourceAgents = enabledSources.map((source) => {
    const createAgent = FACTORIES[source.id];
    if (!createAgent) {
        throw new Error(`No sub-agent factory found for source id: ${source.id}`);
    }
    return createAgent(source);
});

export const rootAgent = new LlmAgent({
    name: "document_hoarder_coordinator",
    model: "gemini-2.5-flash",
    description:
        "Coordinator for multi-source document hoarding across enabled sources.",
    instruction: `Coordinate document hoarding across enabled source sub-agents.
Aggregate auditable outcomes and keep ingestion incremental based on user-provided time range.
Ensure screening policy is enforced: no drafts, only final/released signals, and explicit rejection reasons.`,
    subAgents: sourceAgents,
});

