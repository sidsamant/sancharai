export type HoarderDecision =
    | "accepted"
    | "rejected_draft"
    | "rejected_missing_final_signal"
    | "rejected_non_document";

export interface HoarderMetadata {
    sourceId: string;
    sourcePath: string;
    fileName: string;
    extension: string;
    sourceLocation: string;
    tags: string[];
    ingestedAt: string;
    createdAt?: string;
    updatedAt?: string;
    authors: string[];
    abstract?: string;
    hasImages?: boolean;
    frontImage?: string;
    temporal?: string;
    status?: string;
}

export interface HoarderAuditRecord {
    processedAt: string;
    decision: HoarderDecision;
    reason: string;
    metadata: HoarderMetadata;
}

const FINAL_FOLDER_HINTS = ["/final/", "/approved/"] as const;
const RELEASED_STATUS_HINTS = ["released", "frozen"] as const;
const DRAFT_HINTS = ["draft", "wip", "work in progress"] as const;

function normalize(value: string | undefined): string {
    return (value ?? "").trim().toLowerCase();
}

function includesAny(source: string, hints: readonly string[]): boolean {
    const normalizedSource = normalize(source);
    return hints.some((hint) => normalizedSource.includes(normalize(hint)));
}

function hasAllowedExtension(fileName: string): boolean {
    const allowed = new Set([".md", ".txt", ".docx", ".pdf", ".html"]);
    const dot = fileName.lastIndexOf(".");
    if (dot < 0) {
        return false;
    }
    return allowed.has(fileName.slice(dot).toLowerCase());
}

function isDraftByNameOrTag(meta: HoarderMetadata): boolean {
    if (includesAny(meta.fileName, DRAFT_HINTS)) {
        return true;
    }
    return meta.tags.some((tag) => includesAny(tag, DRAFT_HINTS));
}

function hasFinalSignal(meta: HoarderMetadata): boolean {
    const pathHint = includesAny(meta.sourcePath.replace(/\\/g, "/"), FINAL_FOLDER_HINTS);
    const statusHint = includesAny(meta.status, RELEASED_STATUS_HINTS);
    return pathHint || statusHint;
}

function inferFileMetadataFromPath(path: string): Pick<HoarderMetadata, "fileName" | "extension" | "sourceLocation"> {
    const normalized = path.replace(/\\/g, "/");
    const fileName = normalized.split("/").pop() ?? normalized;
    const dotIndex = fileName.lastIndexOf(".");
    const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
    const sourceLocation = dotIndex >= 0 ? normalized.slice(0, normalized.length - fileName.length) : normalized;
    return { fileName, extension, sourceLocation };
}

export function createMetadata(
    input: Partial<HoarderMetadata> & { sourceId: string; sourcePath: string },
): HoarderMetadata {
    const inferred = inferFileMetadataFromPath(input.sourcePath);

    return {
        sourceId: input.sourceId,
        sourcePath: input.sourcePath,
        fileName: input.fileName ?? inferred.fileName,
        extension: input.extension ?? inferred.extension,
        sourceLocation: input.sourceLocation ?? inferred.sourceLocation,
        tags: input.tags ?? [],
        ingestedAt: input.ingestedAt ?? new Date().toISOString(),
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        authors: input.authors ?? [],
        abstract: input.abstract,
        hasImages: input.hasImages,
        frontImage: input.frontImage,
        temporal: input.temporal,
        status: input.status,
    };
}

export function evaluateDocumentForIngestion(meta: HoarderMetadata): HoarderAuditRecord {
    const processedAt = new Date().toISOString();

    if (!hasAllowedExtension(meta.fileName)) {
        return {
            processedAt,
            decision: "rejected_non_document",
            reason: "Skipped because extension is not in the allowed document list.",
            metadata: meta,
        };
    }

    if (isDraftByNameOrTag(meta)) {
        return {
            processedAt,
            decision: "rejected_draft",
            reason: "Skipped because file name or tags indicate a draft/work-in-progress state.",
            metadata: meta,
        };
    }

    if (!hasFinalSignal(meta)) {
        return {
            processedAt,
            decision: "rejected_missing_final_signal",
            reason: "Skipped because no final/approved folder hint or released/frozen status was detected.",
            metadata: meta,
        };
    }

    return {
        processedAt,
        decision: "accepted",
        reason: "Accepted for downstream standardization and vectorization.",
        metadata: meta,
    };
}
