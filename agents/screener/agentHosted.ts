import { BaseAgent, LlmAgent, createEvent, type Event, type InvocationContext, type RunConfig } from "@google/adk";
import { reviewerInstructionProvider, simpleBeforeModelModifier } from "./util";

class FileMetadataScreeningAgent extends BaseAgent {
    private readonly reviewer: LlmAgent;

    constructor() {
        const reviewer = new LlmAgent({
            name: "file_metadata_reviewer_llm",
            model: "gemini-2.5-flash-lite",
            description: "Reviews filesystem metadata and decides which files are eligible for ingestion.",
            outputKey: "screened_file_list",
            instruction: reviewerInstructionProvider,
            beforeModelCallback: simpleBeforeModelModifier, // Assign the function here
        });

        super({
            name: "file_metadata_screening_agent",
            description: "Custom agent that screens file metadata using an internal LLM reviewer.",
            subAgents: [reviewer],
        });

        this.reviewer = reviewer;
    }

    protected async *runAsyncImpl(context: InvocationContext): AsyncGenerator<Event, void, void> {
        const rawList = context.session.state.file_list;

        if (!rawList || (typeof rawList === "string" && rawList.trim().length === 0)) {
            yield createEvent({
                invocationId: context.invocationId,
                author: this.name,
                content: {
                    role: "model",
                    parts: [{ text: "[]" }],
                },
            });
            return;
        }

        const reviewerRunConfig: RunConfig = {
            ...(context.runConfig ?? {}),
            maxLlmCalls: 1,
        };
        context.runConfig = reviewerRunConfig;

        yield* this.reviewer.runAsync(context);
    }

    protected async *runLiveImpl(context: InvocationContext): AsyncGenerator<Event, void, void> {
        yield* this.runAsyncImpl(context);
    }
}

export const fileMetadataScreeningAgent = new FileMetadataScreeningAgent();
