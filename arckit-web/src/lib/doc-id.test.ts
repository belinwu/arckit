import { describe, it, expect } from "vitest";
import { generateDocId, generateFilename, slugify } from "./doc-id";

describe("generateDocId", () => {
  it("generates single-instance doc ID", () => {
    expect(generateDocId("001", "REQ")).toBe("ARC-001-REQ-v1.0");
  });

  it("generates multi-instance doc ID with sequence", () => {
    expect(generateDocId("001", "ADR", 3)).toBe("ARC-001-ADR-003-v1.0");
  });

  it("generates with custom version", () => {
    expect(generateDocId("002", "STKE", undefined, "2.1")).toBe("ARC-002-STKE-v2.1");
  });
});

describe("generateFilename", () => {
  it("generates markdown filename", () => {
    expect(generateFilename("001", "REQ")).toBe("ARC-001-REQ-v1.0.md");
  });
});

describe("slugify", () => {
  it("converts project name to slug", () => {
    expect(slugify("Payment Gateway System")).toBe("payment-gateway-system");
  });

  it("handles special characters", () => {
    expect(slugify("UK Gov's M365!")).toBe("uk-govs-m365");
  });
});
