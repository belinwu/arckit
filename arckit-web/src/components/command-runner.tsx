"use client";

import { useReducer, useRef, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PhaseAccordion, type PhaseConfig } from "@/components/phase-accordion";
import { StreamingPreview } from "@/components/streaming-preview";
import { MarkdownPreview } from "@/components/markdown-preview";
import { getApiKey } from "@/lib/api-key-store";
import { parseDocumentId, titleForDoc } from "@/lib/artifact-capture";
import { saveArtifact } from "@/lib/store";
import {
  runStateReducer,
  initialRunState,
  type PhaseId,
  type RunState,
} from "@/lib/run-state";
import { Play, Square } from "lucide-react";

interface CommandRunnerProps {
  commandName: string;
  commandDescription: string;
  argumentHint?: string;
  projectId: string;
}

function formatTokens(count: number): string {
  if (count === 0) return "";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k tokens`;
  return `${count} tokens`;
}

/** Live elapsed-time counter that re-renders every second. */
function ElapsedTimer({ startTime }: { startTime: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    setElapsed(Math.floor((performance.now() - startTime) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!startTime) return null;
  return <span>{elapsed}s</span>;
}

const PHASES: PhaseConfig[] = [
  {
    id: "preparing" as PhaseId,
    label: "Preparing",
    summary: (state: RunState) =>
      state.status !== "preparing" && state.startTime
        ? "Ready"
        : undefined,
    stats: (state: RunState) =>
      state.status === "preparing" ? (
        <ElapsedTimer startTime={state.phaseStartTime} />
      ) : undefined,
    body: () => (
      <p className="text-xs text-muted-foreground">
        Loading command and building prompt...
      </p>
    ),
  },
  {
    id: "generating" as PhaseId,
    label: "Generating",
    summary: (state: RunState) =>
      state.status !== "generating" && state.tokenCount > 0
        ? formatTokens(state.tokenCount)
        : undefined,
    stats: (state: RunState) =>
      state.status === "generating" ? (
        <span className="flex items-center gap-2">
          <span>{formatTokens(state.tokenCount)}</span>
          <span className="text-muted-foreground/50">|</span>
          <ElapsedTimer startTime={state.phaseStartTime} />
        </span>
      ) : undefined,
    body: (state: RunState) =>
      state.fullText ? <StreamingPreview text={state.fullText} /> : null,
  },
  {
    id: "saving" as PhaseId,
    label: "Saving",
    summary: (state: RunState) => state.savedDocumentId || undefined,
    stats: () => undefined,
    body: () => (
      <p className="text-xs text-muted-foreground">
        Saving artifact to local storage...
      </p>
    ),
  },
  {
    id: "complete" as PhaseId,
    label: "Complete",
    summary: () => undefined,
    stats: () => undefined,
    body: (state: RunState) => (
      <MarkdownPreview
        content={state.fullText}
        documentId={state.savedDocumentId}
        meta={state.resultMeta}
      />
    ),
  },
];

export function CommandRunner({
  commandName,
  commandDescription,
  argumentHint,
  projectId,
}: CommandRunnerProps) {
  const [userInput, setUserInput] = useState("");
  const [state, dispatch] = useReducer(runStateReducer, initialRunState);
  const abortRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef("");
  const firstTextReceived = useRef(false);

  const running =
    state.status === "preparing" ||
    state.status === "generating" ||
    state.status === "saving";

  function trySaveArtifact(text: string): string | null {
    const parsed = parseDocumentId(text);
    if (!parsed) return null;

    saveArtifact({
      projectId: parsed.projectId || projectId,
      documentId: parsed.documentId,
      documentType: parsed.documentType,
      title: titleForDoc(parsed),
      content: text,
      status: "DRAFT",
      version: parsed.version,
      createdAt: new Date().toISOString(),
    });

    return parsed.documentId;
  }

  async function handleRun() {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const trimmedInput = userInput.trim() || commandDescription;

    dispatch({ type: "RESET" });
    dispatch({ type: "START" });
    fullTextRef.current = "";
    firstTextReceived.current = false;

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
        dispatch({
          type: "ERROR",
          error:
            errData.error || `HTTP ${response.status}: ${response.statusText}`,
        });
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
        dispatch({ type: "ERROR", error: "Command cancelled." });
      } else {
        dispatch({
          type: "ERROR",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleStreamMessage(data: Record<string, unknown>) {
    const type = data.type as string;

    if (type === "assistant") {
      const text = data.text as string | undefined;
      if (text) {
        fullTextRef.current += text;
        if (!firstTextReceived.current) {
          firstTextReceived.current = true;
          dispatch({ type: "FIRST_TEXT", text });
        } else {
          dispatch({ type: "TEXT", text });
        }
      }
    } else if (type === "result" || type === "done") {
      const result =
        typeof data.result === "string" ? data.result : undefined;
      if (result) fullTextRef.current = result;

      dispatch({
        type: "RESULT",
        meta: {
          cost_usd: data.cost_usd as number | undefined,
          duration_ms: data.duration_ms as number | undefined,
          num_turns: data.num_turns as number | undefined,
        },
        fullText: fullTextRef.current,
      });

      const docId = trySaveArtifact(fullTextRef.current);
      dispatch({ type: "SAVED", documentId: docId });
    } else if (type === "error") {
      dispatch({
        type: "ERROR",
        error: (data.error as string) || "Unknown error",
      });
    }
  }

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

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

      <div className="flex-1 overflow-auto p-4">
        {state.status === "idle" && (
          <p className="py-8 text-center text-muted-foreground">
            Output will appear here when you run a command.
          </p>
        )}

        <PhaseAccordion runState={state} phases={PHASES} />
      </div>
    </div>
  );
}
