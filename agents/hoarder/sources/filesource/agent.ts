import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config";
import { createSourceHoarderAgent } from "../../source-agent";

export function createFilesourceHoarderAgent(source: SourceConfig): LlmAgent {
    return createSourceHoarderAgent({
        name: "filesource_hoarder",
        description: "Hoarder sub-agent for filesystem-backed document sources.",
        sourceLabel: "filesystem",
        source,
    });
}

