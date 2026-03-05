import { useRef, useEffect } from "react";

interface StreamingPreviewProps {
  text: string;
  maxLines?: number;
}

export function StreamingPreview({ text, maxLines = 20 }: StreamingPreviewProps) {
  const preRef = useRef<HTMLPreElement>(null);

  const lines = text.split("\n");
  const displayLines =
    lines.length > maxLines ? lines.slice(-maxLines) : lines;
  const truncated = lines.length > maxLines;

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div className="relative">
      {truncated && (
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
      )}
      <pre
        ref={preRef}
        className="max-h-[300px] overflow-y-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono"
      >
        {displayLines.join("\n")}
      </pre>
    </div>
  );
}
