import { loadCommand } from "@/lib/commands";
import { loadTemplate } from "@/lib/templates";
import { buildAgentPrompt, runCommand } from "@/lib/agent-runner";
import { buildProjectContext } from "@/lib/project-context";
import { db } from "@/db";
import { projects, artifacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { commandName, userInput, apiKey, projectId, model } = await req.json();

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

  // Build project context from database
  const allProjects = db.select().from(projects).all();
  const allArtifacts = projectId
    ? db
        .select()
        .from(artifacts)
        .where(eq(artifacts.projectId, projectId))
        .all()
    : db.select().from(artifacts).all();

  const projectContext = buildProjectContext(
    allProjects.map((p) => ({
      projectId: p.projectId,
      slug: p.slug,
      displayName: p.displayName,
    })),
    allArtifacts.map((a) => ({
      projectId: a.projectId,
      documentId: a.documentId,
      documentType: a.documentType,
    })),
    "3.1.0"
  );

  // Build full prompt: project context + command prompt + template
  let fullPrompt = buildAgentPrompt(command.prompt, userInput, template);
  fullPrompt = `${projectContext}\n\n---\n\n${fullPrompt}`;

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

        const done = `data: ${JSON.stringify({ type: "done", result })}\n\n`;
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
