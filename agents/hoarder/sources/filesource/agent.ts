import type { LlmAgent } from "@google/adk";
import type { SourceConfig } from "../../config.js";
import { createFileSystemHoarderAgent } from "./source-agent.ts";

export function createFilesourceHoarderAgent(source: SourceConfig): LlmAgent {
    return createFileSystemHoarderAgent({
        name: "filesource_hoarder",
        description: "Hoarder sub-agent for filesystem-backed document sources.",
        sourceLabel: "filesystem",
        source,
    });
}


