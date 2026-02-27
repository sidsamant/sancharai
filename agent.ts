import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SequentialAgent, type Event, type InvocationContext } from "@google/adk";
import { rootAgent as hoarderAgent } from "./agents/hoarder/agent.ts";
// import { fileMetadataScreeningAgent } from "./agents/screener/agent.ts";
import { fileMetadataScreeningAgent } from "./agents/screener/agent.ts";

// const OUTPUT_FILE_PATH = join(dirname(fileURLToPath("./agent_out.log")), "agent_output.txt");

const OUTPUT_FILE_PATH =  "./agent_output.txt";

class PersistentOutputSequentialAgent extends SequentialAgent {
    async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event, void, undefined> {
        let latestResponseText = "";

        for await (const event of super.runAsyncImpl(ctx)) {
            const eventText =
                event.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";

            if (eventText) {
                latestResponseText = eventText;
            }

            yield event;
        }

        writeFileSync(OUTPUT_FILE_PATH, latestResponseText, "utf8");
    }

    async *runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event, void, undefined> {
        yield* this.runAsyncImpl(ctx);
    }
}

export const rootAgent = new PersistentOutputSequentialAgent({
    name: "root_document_pipeline",
    description: "Root sequential pipeline: hoarder retrieval followed by metadata screening.",
    subAgents: [hoarderAgent, fileMetadataScreeningAgent],
});
