import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config";

export function createConfluenceHoarderAgent(source: SourceConfig): LlmAgent {
    throw new Error(`Confluence sub-agent is not implemented yet for source: ${source.id}`);
}

