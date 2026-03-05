import { describe, it, expect } from "vitest";
import { loadTemplate, listTemplates } from "./templates";

describe("templates", () => {
  it("lists all available templates", () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThan(40);
  });

  it("loads a specific template by name", () => {
    const tpl = loadTemplate("requirements");
    expect(tpl).toBeDefined();
    expect(tpl).toContain("Document Control");
  });

  it("returns undefined for non-existent template", () => {
    const tpl = loadTemplate("nonexistent-xyz");
    expect(tpl).toBeUndefined();
  });
});
