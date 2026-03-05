"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getApiKey } from "@/lib/api-key-store";
import { Play, Square, Loader2 } from "lucide-react";

interface CommandRunnerProps {
  commandName: string;
  commandDescription: string;
  argumentHint?: string;
  projectId: string;
}

interface OutputEntry {
  id: number;
  type: "text" | "tool" | "result" | "error";
  content: string;
  meta?: {
    cost_usd?: number;
    duration_ms?: number;
    num_turns?: number;
  };
}

export function CommandRunner({
  commandName,
  commandDescription,
  argumentHint,
  projectId,
}: CommandRunnerProps) {
  const [userInput, setUserInput] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<OutputEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const scrollToBottom = useCallback(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [output, scrollToBottom]);

  function addEntry(
    type: OutputEntry["type"],
    content: string,
    meta?: OutputEntry["meta"]
  ) {
    idCounter.current += 1;
    setOutput((prev) => [
      ...prev,
      { id: idCounter.current, type, content, meta },
    ]);
  }

  async function handleRun() {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const trimmedInput = userInput.trim() || commandDescription;

    setRunning(true);
    setOutput([]);
    idCounter.current = 0;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandName,
          userInput: trimmedInput,
          apiKey,
          projectId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        addEntry(
          "error",
          errData.error || `HTTP ${response.status}: ${response.statusText}`
        );
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamMessage(data);
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Process remaining buffer
        if (buffer.startsWith("data: ")) {
          try {
            const data = JSON.parse(buffer.slice(6));
            handleStreamMessage(data);
          } catch {
            // ignore
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addEntry("text", "Command cancelled.");
      } else {
        addEntry(
          "error",
          err instanceof Error ? err.message : "Unknown error"
        );
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function handleStreamMessage(data: Record<string, unknown>) {
    const type = data.type as string;

    if (type === "assistant") {
      const message = data.message as {
        content: Array<{
          type: string;
          text?: string;
          name?: string;
        }>;
      };
      if (message?.content) {
        for (const block of message.content) {
          if (block.type === "text" && block.text) {
            addEntry("text", block.text);
          } else if (block.type === "tool_use" && block.name) {
            addEntry("tool", `Using tool: ${block.name}`);
          }
        }
      }
    } else if (type === "result") {
      addEntry("result", (data.result as string) || "Done.", {
        cost_usd: data.cost_usd as number,
        duration_ms: data.duration_ms as number,
        num_turns: data.num_turns as number,
      });
    } else if (type === "done") {
      // Final done event from our API wrapper
      if (typeof data.result === "string" && data.result) {
        addEntry("result", data.result);
      }
    } else if (type === "error") {
      addEntry("error", (data.error as string) || "Unknown error");
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">/arckit.{commandName}</h3>
          {argumentHint && (
            <Badge variant="outline" className="text-[10px]">
              {argumentHint}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {commandDescription}
        </p>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="space-y-1.5">
          <Label htmlFor="user-input">Input</Label>
          <Textarea
            id="user-input"
            placeholder={
              argumentHint
                ? `e.g. ${argumentHint}`
                : "Describe your project or provide context..."
            }
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={3}
            disabled={running}
          />
        </div>
        <div className="flex gap-2">
          {running ? (
            <Button variant="destructive" onClick={handleStop} size="sm">
              <Square className="size-3.5" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleRun} size="sm">
              <Play className="size-3.5" />
              Run Command
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4 font-mono text-sm">
          {output.length === 0 && !running && (
            <p className="py-8 text-center text-muted-foreground font-sans">
              Output will appear here when you run a command.
            </p>
          )}
          {running && output.length === 0 && (
            <div className="flex items-center gap-2 py-4 text-muted-foreground font-sans">
              <Loader2 className="size-4 animate-spin" />
              Running command...
            </div>
          )}
          {output.map((entry) => (
            <div key={entry.id}>
              {entry.type === "text" && (
                <pre className="whitespace-pre-wrap break-words text-foreground">
                  {entry.content}
                </pre>
              )}
              {entry.type === "tool" && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-xs">{entry.content}</span>
                </div>
              )}
              {entry.type === "result" && (
                <div className="mt-2 space-y-2 rounded-md border bg-muted/50 p-3">
                  <pre className="whitespace-pre-wrap break-words text-foreground">
                    {entry.content}
                  </pre>
                  {entry.meta && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {entry.meta.cost_usd != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          ${entry.meta.cost_usd.toFixed(4)}
                        </Badge>
                      )}
                      {entry.meta.duration_ms != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          {(entry.meta.duration_ms / 1000).toFixed(1)}s
                        </Badge>
                      )}
                      {entry.meta.num_turns != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          {entry.meta.num_turns} turn
                          {entry.meta.num_turns !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
              {entry.type === "error" && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                  {entry.content}
                </div>
              )}
            </div>
          ))}
          <div ref={outputEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
