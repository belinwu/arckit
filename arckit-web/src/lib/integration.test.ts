import { describe, it, expect } from "vitest";
import { loadCommands, loadCommand } from "./commands";
import { loadTemplate, listTemplates } from "./templates";
import { buildAgentPrompt, getToolsForCommand } from "./agent-runner";
import { generateDocId } from "./doc-id";

describe("end-to-end integration", () => {
  it("every command has matching metadata", () => {
    const commands = loadCommands();
    for (const cmd of commands) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.prompt).toBeTruthy();
    }
  });

  it("many commands have matching templates", () => {
    const commands = loadCommands();
    const templates = new Set(listTemplates());
    const commandsWithTemplates = commands.filter((c) => templates.has(c.name));
    expect(commandsWithTemplates.length).toBeGreaterThan(20);
  });

  it("can build a complete prompt for requirements command", () => {
    const cmd = loadCommand("requirements");
    const tpl = loadTemplate("requirements");
    expect(cmd).toBeDefined();
    expect(tpl).toBeDefined();

    const prompt = buildAgentPrompt(cmd!.prompt, "Build a payment system", tpl!);
    expect(prompt).toContain("Build a payment system");
    expect(prompt).toContain("Document Control");
    expect(prompt).not.toContain("$ARGUMENTS");
  });

  it("generates correct document IDs for all types", () => {
    expect(generateDocId("001", "REQ")).toBe("ARC-001-REQ-v1.0");
    expect(generateDocId("001", "ADR", 1)).toBe("ARC-001-ADR-001-v1.0");
    expect(generateDocId("002", "DIAG", 5)).toBe("ARC-002-DIAG-005-v1.0");
  });

  it("assigns correct tools per command type", () => {
    const reqTools = getToolsForCommand("requirements");
    const researchTools = getToolsForCommand("research");
    expect(reqTools).not.toContain("WebSearch");
    expect(researchTools).toContain("WebSearch");
  });
});
