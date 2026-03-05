import { describe, it, expect } from "vitest";
import { loadCommands, loadCommand } from "./commands";

describe("loadCommands", () => {
  it("loads all commands from arckit-plugin/commands/", () => {
    const commands = loadCommands();
    expect(commands.length).toBeGreaterThan(50);
    expect(commands[0]).toHaveProperty("name");
    expect(commands[0]).toHaveProperty("description");
    expect(commands[0]).toHaveProperty("prompt");
  });

  it("parses handoffs from frontmatter", () => {
    const cmd = loadCommand("requirements");
    expect(cmd).toBeDefined();
    expect(cmd!.handoffs).toBeDefined();
    expect(cmd!.handoffs!.length).toBeGreaterThan(0);
    expect(cmd!.handoffs![0]).toHaveProperty("command");
  });

  it("parses argument-hint from frontmatter", () => {
    const cmd = loadCommand("requirements");
    expect(cmd).toBeDefined();
    expect(cmd!.argumentHint).toBeDefined();
  });
});
