import { db } from "@/db";
import { artifacts } from "@/db/schema";
import type { StreamMessage, AssistantMessage } from "./agent-runner";

// ---------------------------------------------------------------------------
// Document ID parsing
// ---------------------------------------------------------------------------

/**
 * Regex matching ArcKit document IDs such as:
 *   ARC-001-REQ-v1.0
 *   ARC-002-ADR-003-v1.0
 *
 * Groups: projectId, docType, sequenceNum (optional), version
 */
const DOC_ID_RE =
  /ARC-(\d{3})-([A-Z]{2,4})(?:-(\d{3}))?-v(\d+\.\d+)/;

/**
 * Map of document type codes to human-readable names.
 */
const DOC_TYPE_LABELS: Record<string, string> = {
  REQ: "Requirements Specification",
  STKE: "Stakeholder Analysis",
  RISK: "Risk Register",
  SOBC: "Strategic Outline Business Case",
  ADR: "Architecture Decision Record",
  DIAG: "Architecture Diagram",
  DFD: "Data Flow Diagram",
  WARD: "Wardley Map",
  DMC: "Data Model Catalogue",
  RSCH: "Research Report",
  AWRS: "AWS Research",
  AZRS: "Azure Research",
  GCRS: "GCP Research",
  DSCT: "Data Scout Report",
  PRIN: "Architecture Principles",
  COMP: "Component Specification",
  USTD: "User Stories Document",
  GOAL: "Goals Document",
  DMOD: "Data Model",
  SECD: "Security Design",
  INTD: "Integration Design",
  PERF: "Performance Design",
  COST: "Cost Model",
  ROAD: "Roadmap",
};

export interface ParsedDocId {
  documentId: string;
  projectId: string;
  documentType: string;
  sequenceNum: number | null;
  version: string;
}

/**
 * Attempt to parse an ArcKit document ID from a string (filename or content).
 * Returns null if no valid document ID is found.
 */
export function parseDocumentId(input: string): ParsedDocId | null {
  const m = DOC_ID_RE.exec(input);
  if (!m) return null;
  return {
    documentId: m[0],
    projectId: m[1],
    documentType: m[2],
    sequenceNum: m[3] ? parseInt(m[3], 10) : null,
    version: m[4],
  };
}

/**
 * Derive a human-readable title from the document type and project id.
 */
export function titleForDoc(parsed: ParsedDocId): string {
  const label = DOC_TYPE_LABELS[parsed.documentType] ?? parsed.documentType;
  return `${label} (Project ${parsed.projectId})`;
}

// ---------------------------------------------------------------------------
// Write tool call extraction
// ---------------------------------------------------------------------------

export interface WriteToolCall {
  filePath: string;
  content: string;
}

/**
 * Extract Write tool calls from a single stream message.
 *
 * The `claude --print --output-format stream-json` format emits assistant
 * messages whose `content` array may contain `tool_use` blocks.  We look
 * for blocks where `name === "Write"`.
 */
export function extractWriteCalls(message: StreamMessage): WriteToolCall[] {
  if (message.type !== "assistant") return [];

  const assistantMsg = message as AssistantMessage;
  const content = assistantMsg.message?.content;
  if (!Array.isArray(content)) return [];

  const writes: WriteToolCall[] = [];
  for (const block of content) {
    if (
      block.type === "tool_use" &&
      "name" in block &&
      (block as { name: string }).name === "Write"
    ) {
      const input = (block as { input: Record<string, unknown> }).input;
      const filePath = typeof input?.file_path === "string" ? input.file_path : "";
      const fileContent = typeof input?.content === "string" ? input.content : "";
      if (filePath && fileContent) {
        writes.push({ filePath, content: fileContent });
      }
    }
  }
  return writes;
}

// ---------------------------------------------------------------------------
// Artifact persistence
// ---------------------------------------------------------------------------

export interface CapturedArtifact {
  projectId: string;
  documentId: string;
  documentType: string;
  title: string;
  content: string;
  sequenceNum?: number | null;
  version?: string;
}

/**
 * Save a captured artifact to the database.
 *
 * Uses INSERT semantics.  If a document with the same documentId already
 * exists the unique constraint will cause an error — callers should handle
 * or use onConflictDoUpdate if needed.
 */
export function saveArtifact(artifact: CapturedArtifact): void {
  const now = new Date().toISOString();
  db.insert(artifacts)
    .values({
      projectId: artifact.projectId,
      documentId: artifact.documentId,
      documentType: artifact.documentType,
      sequenceNum: artifact.sequenceNum ?? null,
      title: artifact.title,
      content: artifact.content,
      status: "DRAFT",
      classification: "PUBLIC",
      version: artifact.version ?? "1.0",
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/**
 * Process a Write tool call: if the written file looks like an ArcKit
 * artifact (filename matches `ARC-NNN-TYPE-vX.Y.md`), parse metadata
 * and persist it.
 *
 * Returns the saved artifact metadata or null if the file is not an
 * ArcKit artifact.
 */
export function captureIfArtifact(
  write: WriteToolCall
): CapturedArtifact | null {
  // Try parsing from the file path first (most reliable)
  const parsed = parseDocumentId(write.filePath);
  if (!parsed) return null;

  const artifact: CapturedArtifact = {
    projectId: parsed.projectId,
    documentId: parsed.documentId,
    documentType: parsed.documentType,
    title: titleForDoc(parsed),
    content: write.content,
    sequenceNum: parsed.sequenceNum,
    version: parsed.version,
  };

  saveArtifact(artifact);
  return artifact;
}

// ---------------------------------------------------------------------------
// Convenience: process a full stream message and capture any artifacts
// ---------------------------------------------------------------------------

/**
 * Given a stream message from the Claude CLI, extract any Write tool calls,
 * check if they are ArcKit artifacts, and save them to the database.
 *
 * Returns an array of captured artifacts (may be empty).
 */
export function captureArtifactsFromMessage(
  message: StreamMessage
): CapturedArtifact[] {
  const writes = extractWriteCalls(message);
  const captured: CapturedArtifact[] = [];
  for (const w of writes) {
    const art = captureIfArtifact(w);
    if (art) captured.push(art);
  }
  return captured;
}
