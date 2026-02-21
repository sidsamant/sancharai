import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config";

export function createWhatsappHoarderAgent(source: SourceConfig): LlmAgent {
    throw new Error(`WhatsApp sub-agent is not implemented yet for source: ${source.id}`);
}

