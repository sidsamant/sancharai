import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config";

export function createGdocsHoarderAgent(source: SourceConfig): LlmAgent {
    throw new Error(`Google Docs sub-agent is not implemented yet for source: ${source.id}`);
}

