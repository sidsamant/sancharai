import 'dotenv/config';
import { BaseAgent, CallbackContext } from '@google/adk';
import type { InvocationContext } from '@google/adk';
import { createEvent } from '@google/adk';
import type { Event } from '@google/adk';
import { Ollama } from 'ollama'; // Assuming this is the package name for the local Ollama client

import fetch from 'node-fetch';
import { reviewerInstructionProvider, simpleBeforeModelModifier } from './util.ts';

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
        const response = await this.ollamaClient.chat({
            // model: 'deepseek-coder-v2:latest',
            model: 'deepseek-r1:8b',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            keep_alive: '30m',
        });
        console.log("Received response from Ollama:", JSON.stringify(response, null, 2));

        // chat() non-stream response carries text at response.message.content
        // @ts-expect-error tolerate minor SDK shape differences
        return response?.message?.content ?? JSON.stringify(response);
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

        const callbackContext = new CallbackContext({ invocationContext: context });
        const request = {
            config: {},
            contents: [
                {
                    role: "user",
                    parts: [{ text: JSON.stringify(rawList) }],
                },
            ],
        };
        simpleBeforeModelModifier({ context: callbackContext, request });

        const prompt =
            (request as any).config?.systemInstruction?.parts?.[0]?.text ??
            reviewerInstructionProvider(callbackContext);
        console.log("Generated prompt for Ollama:", prompt);
        const ollamaResponse = await this.callOllama(prompt);
        console.log("ollamaResponse:", ollamaResponse);

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
