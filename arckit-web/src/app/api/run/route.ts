import { loadCommand } from "@/lib/commands";
import { loadTemplate } from "@/lib/templates";
import { buildAgentPrompt, runCommand } from "@/lib/agent-runner";

export async function POST(req: Request) {
  const { commandName, userInput, apiKey, model } = await req.json();

  if (!commandName || !userInput || !apiKey) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const command = loadCommand(commandName);
  if (!command) {
    return new Response(
      JSON.stringify({ error: `Unknown command: ${commandName}` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Load template if one exists for this command
  const template = loadTemplate(commandName);
  const fullPrompt = buildAgentPrompt(command.prompt, userInput, template);

  // Stream response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runCommand({
          commandName,
          prompt: fullPrompt,
          apiKey,
          model,
          onMessage: (message) => {
            const data = `data: ${JSON.stringify(message)}\n\n`;
            controller.enqueue(encoder.encode(data));
          },
        });

        const done = `data: ${JSON.stringify({
          type: "done",
          result,
        })}\n\n`;
        controller.enqueue(encoder.encode(done));
      } catch (error: unknown) {
        const errMsg = `data: ${JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        })}\n\n`;
        controller.enqueue(encoder.encode(errMsg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
