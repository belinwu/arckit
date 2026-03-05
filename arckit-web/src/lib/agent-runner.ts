import Anthropic from "@anthropic-ai/sdk";

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
// Command runner using Anthropic Messages API
// ---------------------------------------------------------------------------

export interface RunCommandOptions {
  /** The ArcKit command name (e.g. "requirements", "research"). */
  commandName: string;
  /** The fully-built prompt (output of buildAgentPrompt). */
  prompt: string;
  /** Anthropic API key. */
  apiKey: string;
  /** Override the model (defaults to claude-sonnet-4-6). */
  model?: string;
  /** Called for every streaming message. */
  onMessage?: (message: { type: string; [key: string]: unknown }) => void;
}

/**
 * Run an ArcKit command using the Anthropic Messages API with streaming.
 *
 * Streams the response via the SDK and calls `onMessage` for each text
 * chunk. Returns the full concatenated text at the end.
 */
export async function runCommand(options: RunCommandOptions): Promise<string> {
  const { prompt, apiKey, model, onMessage } = options;

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: model || "claude-sonnet-4-6",
    max_tokens: 16384,
    messages: [{ role: "user", content: prompt }],
    system:
      "You are ArcKit, an Enterprise Architecture Governance assistant. " +
      "Generate architecture documents following the provided template exactly. " +
      "Use the Document Control format. Output the complete document in a single markdown code block.",
  });

  let fullText = "";

  stream.on("text", (text) => {
    fullText += text;
    onMessage?.({ type: "assistant", text });
  });

  const finalMessage = await stream.finalMessage();

  onMessage?.({
    type: "result",
    result: fullText,
    usage: finalMessage.usage,
  });

  return fullText;
}
