import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface Handoff {
  command: string;
  description?: string;
  condition?: string;
}

export interface ArcKitCommand {
  name: string;
  description: string;
  argumentHint?: string;
  prompt: string;
  handoffs?: Handoff[];
}

/**
 * Resolve the path to the commands directory.
 *
 * Resolution order:
 * 1. Bundled data (data/commands/) — for Vercel deployments
 * 2. cwd-based (../arckit-plugin/commands/) — for local dev
 * 3. __dirname-based fallback
 */
function getCommandsDir(): string {
  // Check bundled data first (for Vercel)
  const bundled = path.resolve(process.cwd(), "data", "commands");
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  // Try cwd-based resolution: cwd is typically <repo-root>/arckit-web/
  const cwdBased = path.resolve(process.cwd(), "..", "arckit-plugin", "commands");
  if (fs.existsSync(cwdBased)) {
    return cwdBased;
  }

  // Fallback: __dirname-based resolution (src/lib/ -> ../../.. -> repo root)
  const dirnameBased = path.resolve(__dirname, "..", "..", "..", "arckit-plugin", "commands");
  if (fs.existsSync(dirnameBased)) {
    return dirnameBased;
  }

  throw new Error(
    `Cannot find commands directory. Tried:\n  ${bundled}\n  ${cwdBased}\n  ${dirnameBased}`
  );
}

export function loadCommands(): ArcKitCommand[] {
  const commandsDir = getCommandsDir();
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
  return files.map((file) => parseCommandFile(path.join(commandsDir, file)));
}

export function loadCommand(name: string): ArcKitCommand | undefined {
  const commandsDir = getCommandsDir();
  const filePath = path.join(commandsDir, `${name}.md`);
  if (!fs.existsSync(filePath)) return undefined;
  return parseCommandFile(filePath);
}

function parseCommandFile(filePath: string): ArcKitCommand {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const name = path.basename(filePath, ".md");

  return {
    name,
    description: data.description || "",
    argumentHint: data["argument-hint"],
    prompt: content.trim(),
    handoffs: data.handoffs,
  };
}
