"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";

interface MarkdownPreviewProps {
  content: string;
  documentId?: string | null;
  meta?: {
    cost_usd?: number;
    duration_ms?: number;
    num_turns?: number;
  } | null;
}

export function MarkdownPreview({
  content,
  documentId,
  meta,
}: MarkdownPreviewProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const filename = documentId
      ? `${documentId}.md`
      : "arckit-output.md";
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy Markdown"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="size-3.5" />
          Download
        </Button>
      </div>

      {meta && (
        <div className="flex flex-wrap gap-2">
          {meta.cost_usd != null && (
            <Badge variant="secondary" className="text-[10px]">
              ${meta.cost_usd.toFixed(4)}
            </Badge>
          )}
          {meta.duration_ms != null && (
            <Badge variant="secondary" className="text-[10px]">
              {(meta.duration_ms / 1000).toFixed(1)}s
            </Badge>
          )}
          {meta.num_turns != null && (
            <Badge variant="secondary" className="text-[10px]">
              {meta.num_turns} turn{meta.num_turns !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      <div className="arckit-markdown max-w-none rounded-md border p-4 overflow-auto max-h-[500px] text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
