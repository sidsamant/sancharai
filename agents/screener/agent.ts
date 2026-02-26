import { BaseAgent, LlmAgent, createEvent, type Event, type InvocationContext } from "@google/adk";

class FileMetadataScreeningAgent extends BaseAgent {
    private readonly reviewer: LlmAgent;

    constructor() {
        const reviewer = new LlmAgent({
            name: "file_metadata_reviewer_llm",
            model: "gemini-2.5-flash",
            description: "Reviews filesystem metadata and decides which files are eligible for ingestion.",
            outputKey: "screened_file_list",
            instruction: `You are a metadata screening agent.
Input file metadata JSON array is in session state key: {file_list}.
Optional additional screening rules may be present in {screening_rules}.

Apply these baseline rules:
1. Reject files that are draft.
2. Reject files that are confidential.
3. For multiple versions of the same logical document, select only the latest version.

Interpretation hints:
- Use file name/path patterns like draft, wip, tmp for draft detection.
- Use file name/path patterns like confidential, secret, internal-only for confidentiality detection.
- For latest version, use version hints (v1, v2, final, rev) and timestamps (modifiedAt first, then createdAt).

Examples -
  1. A file named "project_plan_draft.docx" would be rejected as a draft.
  2. A file named "employee_salaries_confidential.xlsx" would be rejected as confidential.
  3. Given files "report_v1.docx", "report_v2.docx", and "report_final.docx", only "report_final.docx" would be selected as the latest version.

Output requirements:
- Return ONLY valid JSON.
- Output must be a JSON array.
- Include every input file exactly once.
- Preserve all original metadata fields from each input item.
- If input is missing/invalid, return an empty JSON array.

Schema of output items:{
    "files":[
            {
                "path":"path/to/file",
                "name": "file name",
                "createdAt": "timestamp",
                "modifiedAt": "timestamp",
                "isSelected": true, // or false if rejected
                "rejectionReason": "reason for rejection if isSelected is false, otherwise null"
                // any other original metadata fields should also be preserved
            }
    ]
}

`,
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

        yield* this.reviewer.runAsync(context);
    }

    protected async *runLiveImpl(context: InvocationContext): AsyncGenerator<Event, void, void> {
        yield* this.runAsyncImpl(context);
    }
}

export const fileMetadataScreeningAgent = new FileMetadataScreeningAgent();
