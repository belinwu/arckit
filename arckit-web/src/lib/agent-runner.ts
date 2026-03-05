import { spawn } from "child_process";

/**
 * Commands that need web research tools in addition to base tools.
 */
const RESEARCH_COMMANDS = new Set([
  "research",
  "datascout",
  "aws-research",
  "azure-research",
  "gcp-research",
]);

const BASE_TOOLS = ["Read", "Write", "Glob", "Grep"];
const RESEARCH_TOOLS = [...BASE_TOOLS, "WebSearch", "WebFetch"];

/**
 * Return the list of tools that should be allowed for a given command.
 *
 * Research-oriented commands get WebSearch and WebFetch in addition to the
 * base file-system tools.
 */
export function getToolsForCommand(commandName: string): string[] {
  if (RESEARCH_COMMANDS.has(commandName)) return [...RESEARCH_TOOLS];
  return [...BASE_TOOLS];
}

/**
 * Build the full prompt string sent to the agent.
 *
 * Replaces every occurrence of `$ARGUMENTS` in the command prompt with the
 * user-supplied input.  If a template is provided it is appended as a
 * `## Template Content` section.
 */
export function buildAgentPrompt(
  commandPrompt: string,
  userInput: string,
  templateContent?: string
): string {
  let prompt = commandPrompt.replace(/\$ARGUMENTS/g, userInput);

  if (templateContent) {
    prompt += `\n\n## Template Content\n\n${templateContent}`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Streaming message types emitted by `claude --print --output-format stream-json`
// ---------------------------------------------------------------------------

export interface AssistantMessage {
  type: "assistant";
  message: {
    content: Array<{ type: "text"; text: string } | { type: "tool_use"; name: string; input: unknown }>;
  };
}

export interface ResultMessage {
  type: "result";
  result: string;
  cost_usd: number;
  duration_ms: number;
  num_turns: number;
}

export type StreamMessage = AssistantMessage | ResultMessage | { type: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

export interface RunCommandOptions {
  /** The ArcKit command name (e.g. "requirements", "research"). */
  commandName: string;
  /** The fully-built prompt (output of buildAgentPrompt). */
  prompt: string;
  /** Anthropic API key — passed via ANTHROPIC_API_KEY env var. */
  apiKey: string;
  /** Override the model (defaults to claude-sonnet-4-6). */
  model?: string;
  /** Working directory for the claude process. */
  cwd?: string;
  /** Called for every streaming JSON message from the CLI. */
  onMessage?: (message: StreamMessage) => void;
}

/**
 * Run an ArcKit command by spawning `claude --print` with streaming JSON
 * output.
 *
 * This uses the Claude Code CLI in non-interactive print mode, which is the
 * supported programmatic interface for v2.x of the `@anthropic-ai/claude-code`
 * package.  The CLI is invoked with:
 *
 *   claude -p --output-format stream-json \
 *          --model <model> \
 *          --permission-mode acceptEdits \
 *          --allowedTools <tools...> \
 *          "<prompt>"
 *
 * Each line of stdout is a JSON object describing a streaming event.
 * The final event has `type: "result"` and contains the result text.
 */
export async function runCommand(options: RunCommandOptions): Promise<string> {
  const {
    commandName,
    prompt,
    apiKey,
    model = "claude-sonnet-4-6",
    cwd,
    onMessage,
  } = options;

  const tools = getToolsForCommand(commandName);

  return new Promise<string>((resolve, reject) => {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--model",
      model,
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      ...tools,
      prompt,
    ];

    const child = spawn("claude", args, {
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: apiKey,
        // Unset CLAUDECODE to avoid "nested session" guard
        CLAUDECODE: "",
      },
      cwd: cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resultText = "Command completed.";
    let stderrChunks: string[] = [];
    let buffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      // Each message is a single JSON line
      const lines = buffer.split("\n");
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg: StreamMessage = JSON.parse(trimmed);
          onMessage?.(msg);
          if (msg.type === "result" && "result" in msg) {
            resultText = (msg as ResultMessage).result;
          }
        } catch {
          // Non-JSON output — skip
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    child.on("close", (code) => {
      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          const msg: StreamMessage = JSON.parse(buffer.trim());
          onMessage?.(msg);
          if (msg.type === "result" && "result" in msg) {
            resultText = (msg as ResultMessage).result;
          }
        } catch {
          // ignore
        }
      }

      if (code !== 0 && code !== null) {
        const stderr = stderrChunks.join("");
        reject(
          new Error(
            `claude CLI exited with code ${code}${stderr ? `: ${stderr.slice(0, 500)}` : ""}`
          )
        );
        return;
      }
      resolve(resultText);
    });
  });
}
