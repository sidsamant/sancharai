import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config.js";

export function createSharepointHoarderAgent(source: SourceConfig): LlmAgent {
    throw new Error(`SharePoint sub-agent is not implemented yet for source: ${source.id}`);
}


