import { CallbackContext, InstructionProvider, ReadonlyContext } from "@google/adk";

export const reviewerInstructionProvider: InstructionProvider = (context: ReadonlyContext): string => {
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
                "isSelected": true, // or false if rejected
                "rejectionReason": "reason for rejection if isSelected is false, otherwise null"
            }
    ]
}`;
};

export function simpleBeforeModelModifier({
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
