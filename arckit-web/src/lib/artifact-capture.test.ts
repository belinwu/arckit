import { describe, it, expect } from "vitest";
import {
  parseDocumentId,
  titleForDoc,
  extractWriteCalls,
  type ParsedDocId,
  type StreamMessage,
  type AssistantMessage,
} from "./artifact-capture";

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
