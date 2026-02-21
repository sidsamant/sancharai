import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SourceConfig {
    id: string;
    enabled: boolean;
    path: string;
}

export interface HoarderConfig {
    sources: SourceConfig[];
}

function parseBoolean(value: string): boolean {
    return value.trim().toLowerCase() === "true";
}

function stripQuotes(value: string): string {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

// Minimal parser for the config.yaml schema used by this agent.
function parseHoarderYaml(yamlText: string): HoarderConfig {
    const lines = yamlText
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+#.*$/, ""))
        .map((line) => line.trimEnd());

    const sources: SourceConfig[] = [];
    let current: Partial<SourceConfig> | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line === "sources:") {
            continue;
        }

        if (line.startsWith("- ")) {
            if (current?.id && typeof current.enabled === "boolean" && current.path) {
                sources.push(current as SourceConfig);
            }
            current = {};
            const inline = line.slice(2).trim();
            if (inline.startsWith("id:")) {
                current.id = stripQuotes(inline.slice(3));
            }
            continue;
        }

        if (!current) {
            continue;
        }

        const separator = line.indexOf(":");
        if (separator < 0) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        const value = stripQuotes(line.slice(separator + 1));

        if (key === "id") {
            current.id = value;
        } else if (key === "enabled") {
            current.enabled = parseBoolean(value);
        } else if (key === "path") {
            current.path = value;
        }
    }

    if (current?.id && typeof current.enabled === "boolean" && current.path) {
        sources.push(current as SourceConfig);
    }

    return { sources };
}

export function loadHoarderConfig(): HoarderConfig {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(thisDir, "config.yaml");
    const fileContent = readFileSync(filePath, "utf8");
    const parsed = parseHoarderYaml(fileContent);

    if (!parsed.sources.length) {
        throw new Error("No sources configured in adk/agents/hoarder/config.yaml");
    }

    return parsed;
}
