import { describe, it, expect } from "vitest";
import { buildAgentPrompt, getToolsForCommand } from "./agent-runner";

describe("buildAgentPrompt", () => {
  it("replaces $ARGUMENTS in command prompt", () => {
    const prompt = buildAgentPrompt(
      "Generate requirements for:\n\n```text\n$ARGUMENTS\n```",
      "payment system",
      "# Requirements Template\n..."
    );
    expect(prompt).toContain("payment system");
    expect(prompt).not.toContain("$ARGUMENTS");
    expect(prompt).toContain("# Requirements Template");
  });

  it("works without template", () => {
    const prompt = buildAgentPrompt("Hello $ARGUMENTS", "world");
    expect(prompt).toBe("Hello world");
  });

  it("replaces multiple occurrences of $ARGUMENTS", () => {
    const prompt = buildAgentPrompt(
      "First: $ARGUMENTS, Second: $ARGUMENTS",
      "test-value"
    );
    expect(prompt).toBe("First: test-value, Second: test-value");
    expect(prompt).not.toContain("$ARGUMENTS");
  });

  it("appends template under a ## Template Content heading", () => {
    const prompt = buildAgentPrompt(
      "Do the thing",
      "input",
      "## Section A\nContent here"
    );
    expect(prompt).toContain("## Template Content");
    expect(prompt).toContain("## Section A\nContent here");
    // The template section should come after the main prompt
    const mainEnd = prompt.indexOf("Do the thing") + "Do the thing".length;
    const templateStart = prompt.indexOf("## Template Content");
    expect(templateStart).toBeGreaterThan(mainEnd);
  });

  it("handles empty user input", () => {
    const prompt = buildAgentPrompt("Prompt: $ARGUMENTS", "");
    expect(prompt).toBe("Prompt: ");
  });

  it("handles prompt with no $ARGUMENTS placeholder", () => {
    const prompt = buildAgentPrompt("Static prompt with no placeholder", "ignored");
    expect(prompt).toBe("Static prompt with no placeholder");
  });
});

describe("getToolsForCommand", () => {
  it("returns base tools for standard commands", () => {
    const tools = getToolsForCommand("requirements");
    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
    expect(tools).toContain("Glob");
    expect(tools).toContain("Grep");
    expect(tools).not.toContain("WebSearch");
    expect(tools).not.toContain("WebFetch");
  });

  it("returns research tools for research commands", () => {
    const tools = getToolsForCommand("research");
    expect(tools).toContain("WebSearch");
    expect(tools).toContain("WebFetch");
    // Should also include base tools
    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
  });

  it("returns research tools for datascout", () => {
    const tools = getToolsForCommand("datascout");
    expect(tools).toContain("WebSearch");
    expect(tools).toContain("WebFetch");
  });

  it("returns research tools for cloud research commands", () => {
    for (const cmd of ["aws-research", "azure-research", "gcp-research"]) {
      const tools = getToolsForCommand(cmd);
      expect(tools).toContain("WebSearch");
      expect(tools).toContain("WebFetch");
    }
  });

  it("returns base tools for unknown commands", () => {
    const tools = getToolsForCommand("nonexistent");
    expect(tools).toEqual(["Read", "Write", "Glob", "Grep"]);
  });

  it("returns a new array each time (no shared references)", () => {
    const a = getToolsForCommand("requirements");
    const b = getToolsForCommand("requirements");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
