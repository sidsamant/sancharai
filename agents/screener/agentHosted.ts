import { BaseAgent, CallbackContext, LlmAgent, createEvent, type Event, type InstructionProvider, type InvocationContext, type ReadonlyContext, type RunConfig } from "@google/adk";

const reviewerInstructionProvider: InstructionProvider = (context: ReadonlyContext): string => {
    const fileList = context.state.get<unknown>("file_list");
    const screeningRules = context.state.get<unknown>("screening_rules");

    const fileListJson = fileList === undefined ? "[]" : JSON.stringify(fileList, null, 2);
    const screeningRulesJson = screeningRules === undefined ? "{}" : JSON.stringify(screeningRules, null, 2);

    return `You are a metadata screening agent.
## List of files to screen
    Input files with metadata as JSON array:
    ${fileListJson}

## Screening rules

### Apply these baseline rules:
1. Reject files that are draft.
2. Reject files that are confidential.
3. For multiple versions of the same logical document, select only the latest version.

### Interpretation hints:
- Use file name/path patterns like draft, wip, tmp for draft detection.
- Use file name/path patterns like confidential, secret, internal-only for confidentiality detection.
- For latest version, use version hints (v1, v2, final, rev) and timestamps (modifiedAt first, then createdAt).

### Additional screening rules:
${screeningRulesJson}

## Output requirements
- Return ONLY valid JSON.
- Output must be a JSON array.
- Include every input file exactly once.
- Preserve all original metadata fields from each input item.
- If input is missing/invalid, return an empty JSON array.

### JSON Schema of output items:
   {
    "files":[
            {
                "path":"path/to/file",
                "name": "file name",
                "createdAt": "timestamp",
                "modifiedAt": "timestamp",
                "isSelected": true,
                "rejectionReason": "reason for rejection if isSelected is false, otherwise null"
            }
    ]
}`;
};

// --- Define the Callback Function ---
function simpleBeforeModelModifier({
  context,
  request,
}: {
  context: CallbackContext;
  request: any;
}): any | undefined {
  console.log(`[Callback] Before model call for agent: ${context.agentName}`);
  console.log(`[Callback] request all: '${JSON.stringify(request.config)}'`);
  console.log(`[Callback] request all: '${JSON.stringify(request)}'`);
//   console.log(`[Callback] context: ${JSON.stringify(context)}`);
  console.log(`[Callback] request.contents all: '${JSON.stringify(request.contents)}'`);

  const runtimeInstruction = reviewerInstructionProvider(context);
  request.config = request.config ?? {};
  request.config.systemInstruction = {
    role: "system",
    parts: [{ text: runtimeInstruction }],
  };
  console.log("[Callback] Applied runtime instruction from InstructionProvider.");

  return undefined;
}

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
