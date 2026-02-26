import "dotenv/config";
import { SequentialAgent } from "@google/adk";
import { filesourceAgent } from "./sources/filesource/agent.ts";

export const rootAgent = new SequentialAgent({
    name: "document_hoarder_coordinator",
    description: "Sequential hoarder agent for filesystem retrieval.",
    subAgents: [filesourceAgent],
});
