import 'dotenv/config';
import { BaseAgent } from '@google/adk';
import type { InvocationContext } from '@google/adk';
import { createEvent } from '@google/adk';
import type { Event } from '@google/adk';
import { Ollama } from 'ollama'; // Assuming this is the package name for the local Ollama client

import fetch from 'node-fetch';

class FileMetadataScreeningAgent extends BaseAgent {
    private ollamaClient: Ollama;

    constructor() {
        super({
            name: 'file_metadata_screening_agent',
            description: "Custom agent that screens file metadata using an internal LLM reviewer.",
        });

        // Initialize the Ollama client with appropriate host and model configuration
        this.ollamaClient = new Ollama({
            fetch: fetch as any , // Pass the fetch implementation if required by the Ollama SDK
            host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
        });
    }

    private async callOllama(prompt: string): Promise<string> {
        const response = await this.ollamaClient.generate({
            //   model: 'deepseek-r1:8b', // Adjust the model as needed
            model: 'deepseek-coder-v2:latest', // Adjust the model as needed
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            options: {
                keep_alive: '30m',
            },
        });

        return response.response; // Adjust based on the actual Ollama SDK structure
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

        const prompt = `You are a metadata screening agent.
    
Input file metadata JSON array is in session state key: {file_list}

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
    `;
        console.log("Generated prompt for Ollama:", prompt);
        const ollamaResponse = await this.callOllama(prompt);

        yield createEvent({
            invocationId: context.invocationId,
            author: this.name,
            content: {
                role: 'model',
                parts: [{ text: ollamaResponse }],
            },
        });
    }

    protected async *runLiveImpl(context: InvocationContext): AsyncGenerator<Event, void, void> {
        yield* this.runAsyncImpl(context);
    }
}

export const fileMetadataScreeningAgent = new FileMetadataScreeningAgent();