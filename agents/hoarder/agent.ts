import "dotenv/config";
import { LlmAgent } from "@google/adk";
import { loadHoarderConfig } from "./config.js";
import { createConfluenceHoarderAgent } from "./sources/confluence/agent.js";
import { createFilesourceHoarderAgent } from "./sources/filesource/agent.js";
import { createGdocsHoarderAgent } from "./sources/gdocs/agent.js";
import { createSharepointHoarderAgent } from "./sources/sharepoint/agent.js";
import { createSlackHoarderAgent } from "./sources/slack/agent.js";
import { createWhatsappHoarderAgent } from "./sources/whatsapp/agent.js";
import type { SourceConfig } from "./config.js";
import { getToolsForSource, readFileListFromSource } from "./sources/filesource/source-agent.ts";

// export { createMetadata, evaluateDocumentForIngestion } from "./policy.js";
// export type { HoarderAuditRecord, HoarderDecision, HoarderMetadata } from "./policy.js";
export { getToolsForSource, readFileListFromSource };

type SourceAgentFactory = (source: SourceConfig) => LlmAgent;

const FACTORIES: Record<string, SourceAgentFactory> = {
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


