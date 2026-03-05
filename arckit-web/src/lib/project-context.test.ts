import { describe, it, expect } from "vitest";
import { buildProjectContext } from "./project-context";

describe("buildProjectContext", () => {
  it("returns context string with ArcKit header", () => {
    const context = buildProjectContext([], [], "3.1.0");
    expect(context).toContain("ArcKit Project Context");
    expect(context).toContain("ArcKit Version: 3.1.0");
  });

  it("lists projects with artifact counts", () => {
    const projects = [
      { projectId: "001", slug: "payment-gateway", displayName: "Payment Gateway" },
    ];
    const artifacts = [
      { projectId: "001", documentId: "ARC-001-REQ-v1.0", documentType: "REQ" },
      { projectId: "001", documentId: "ARC-001-STKE-v1.0", documentType: "STKE" },
    ];
    const context = buildProjectContext(projects, artifacts, "3.1.0");
    expect(context).toContain("001-payment-gateway");
    expect(context).toContain("**Artifacts** (2)");
    expect(context).toContain("ARC-001-REQ-v1.0");
  });

  it("shows 0 projects when empty", () => {
    const context = buildProjectContext([], [], "3.1.0");
    expect(context).toContain("**0 project(s) found:**");
  });
});
