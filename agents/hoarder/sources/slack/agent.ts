import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config";

export function createSlackHoarderAgent(source: SourceConfig): LlmAgent {
    throw new Error(`Slack sub-agent is not implemented yet for source: ${source.id}`);
}

