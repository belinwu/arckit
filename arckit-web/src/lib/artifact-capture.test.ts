import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseDocumentId,
  titleForDoc,
  extractWriteCalls,
  captureArtifactsFromMessage,
  type ParsedDocId,
} from "./artifact-capture";
import type { StreamMessage, AssistantMessage } from "./agent-runner";

// ---------------------------------------------------------------------------
// Mock the database so tests don't require SQLite
// ---------------------------------------------------------------------------
vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        run: vi.fn(),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// parseDocumentId
// ---------------------------------------------------------------------------

describe("parseDocumentId", () => {
  it("parses a single-instance document ID", () => {
    const result = parseDocumentId("ARC-001-REQ-v1.0");
    expect(result).toEqual({
      documentId: "ARC-001-REQ-v1.0",
      projectId: "001",
      documentType: "REQ",
      sequenceNum: null,
      version: "1.0",
    });
  });

  it("parses a multi-instance document ID with sequence number", () => {
    const result = parseDocumentId("ARC-002-ADR-003-v1.0");
    expect(result).toEqual({
      documentId: "ARC-002-ADR-003-v1.0",
      projectId: "002",
      documentType: "ADR",
      sequenceNum: 3,
      version: "1.0",
    });
  });

  it("parses from a full file path", () => {
    const result = parseDocumentId(
      "/projects/001-payment-gateway/ARC-001-STKE-v1.0.md"
    );
    expect(result).not.toBeNull();
    expect(result!.documentId).toBe("ARC-001-STKE-v1.0");
    expect(result!.documentType).toBe("STKE");
  });

  it("parses a version other than 1.0", () => {
    const result = parseDocumentId("ARC-005-RISK-v2.3");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("2.3");
  });

  it("returns null for non-ArcKit strings", () => {
    expect(parseDocumentId("README.md")).toBeNull();
    expect(parseDocumentId("some random text")).toBeNull();
    expect(parseDocumentId("")).toBeNull();
  });

  it("returns null for malformed IDs", () => {
    expect(parseDocumentId("ARC-1-REQ-v1.0")).toBeNull(); // projectId too short
    expect(parseDocumentId("ARC-001-R-v1.0")).toBeNull(); // docType too short
  });
});

// ---------------------------------------------------------------------------
// titleForDoc
// ---------------------------------------------------------------------------

describe("titleForDoc", () => {
  it("returns a readable title for known document types", () => {
    const parsed: ParsedDocId = {
      documentId: "ARC-001-REQ-v1.0",
      projectId: "001",
      documentType: "REQ",
      sequenceNum: null,
      version: "1.0",
    };
    expect(titleForDoc(parsed)).toBe("Requirements Specification (Project 001)");
  });

  it("falls back to the raw type code for unknown types", () => {
    const parsed: ParsedDocId = {
      documentId: "ARC-001-ZZZZ-v1.0",
      projectId: "001",
      documentType: "ZZZZ",
      sequenceNum: null,
      version: "1.0",
    };
    expect(titleForDoc(parsed)).toBe("ZZZZ (Project 001)");
  });
});

// ---------------------------------------------------------------------------
// extractWriteCalls
// ---------------------------------------------------------------------------

describe("extractWriteCalls", () => {
  it("extracts Write tool calls from an assistant message", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path: "/projects/001-foo/ARC-001-REQ-v1.0.md",
              content: "# Requirements\n\nContent here...",
            },
          },
        ],
      },
    };

    const writes = extractWriteCalls(msg);
    expect(writes).toHaveLength(1);
    expect(writes[0].filePath).toBe(
      "/projects/001-foo/ARC-001-REQ-v1.0.md"
    );
    expect(writes[0].content).toBe("# Requirements\n\nContent here...");
  });

  it("ignores non-Write tool calls", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Read",
            input: { file_path: "/some/file.md" },
          },
        ],
      },
    };

    const writes = extractWriteCalls(msg);
    expect(writes).toHaveLength(0);
  });

  it("handles text-only assistant messages", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Here is the summary..." }],
      },
    };

    const writes = extractWriteCalls(msg);
    expect(writes).toHaveLength(0);
  });

  it("returns empty array for non-assistant messages", () => {
    const msg: StreamMessage = {
      type: "result",
      result: "done",
      cost_usd: 0.01,
      duration_ms: 1000,
      num_turns: 1,
    };

    const writes = extractWriteCalls(msg);
    expect(writes).toHaveLength(0);
  });

  it("extracts multiple Write calls from one message", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path: "/p/ARC-001-REQ-v1.0.md",
              content: "req content",
            },
          },
          { type: "text", text: "Also writing stakeholders..." },
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path: "/p/ARC-001-STKE-v1.0.md",
              content: "stke content",
            },
          },
        ],
      },
    };

    const writes = extractWriteCalls(msg);
    expect(writes).toHaveLength(2);
  });

  it("skips Write calls with missing file_path or content", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: { file_path: "", content: "some content" },
          },
          {
            type: "tool_use",
            name: "Write",
            input: { file_path: "/valid/path.md", content: "" },
          },
        ],
      },
    };

    const writes = extractWriteCalls(msg);
    expect(writes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// captureArtifactsFromMessage (integration of extract + parse + save)
// ---------------------------------------------------------------------------

describe("captureArtifactsFromMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures an artifact from a Write tool call with an ArcKit filename", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path:
                "/projects/001-payment-gateway/ARC-001-REQ-v1.0.md",
              content: "# Requirements\n\n## Business Requirements\n...",
            },
          },
        ],
      },
    };

    const captured = captureArtifactsFromMessage(msg);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      projectId: "001",
      documentId: "ARC-001-REQ-v1.0",
      documentType: "REQ",
      title: "Requirements Specification (Project 001)",
    });
    // Content should be preserved
    expect(captured[0].content).toContain("Business Requirements");
  });

  it("ignores Write calls to non-ArcKit files", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path: "/tmp/notes.md",
              content: "Just some notes",
            },
          },
        ],
      },
    };

    const captured = captureArtifactsFromMessage(msg);
    expect(captured).toHaveLength(0);
  });

  it("handles result messages gracefully", () => {
    const msg: StreamMessage = {
      type: "result",
      result: "All done",
      cost_usd: 0.05,
      duration_ms: 5000,
      num_turns: 3,
    };

    const captured = captureArtifactsFromMessage(msg);
    expect(captured).toHaveLength(0);
  });

  it("captures multi-instance document with sequence number", () => {
    const msg: AssistantMessage = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path: "/projects/002-nhs/ARC-002-ADR-001-v1.0.md",
              content: "# ADR-001: Use microservices",
            },
          },
        ],
      },
    };

    const captured = captureArtifactsFromMessage(msg);
    expect(captured).toHaveLength(1);
    expect(captured[0].documentId).toBe("ARC-002-ADR-001-v1.0");
    expect(captured[0].sequenceNum).toBe(1);
  });
});
