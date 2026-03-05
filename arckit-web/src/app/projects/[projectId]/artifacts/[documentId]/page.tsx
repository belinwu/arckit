"use client";

import { use, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ArtifactPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const { projectId, documentId } = use(params);
  const [artifact, setArtifact] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/artifacts`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.artifacts.find(
          (a: any) => a.documentId === decodeURIComponent(documentId)
        );
        setArtifact(found);
      });
  }, [projectId, documentId]);

  if (!artifact) return <div className="p-8">Loading...</div>;

  const handleExport = () => {
    const blob = new Blob([artifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.documentId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href={`/projects/${projectId}`} className="text-muted-foreground hover:text-foreground">
            Back to project
          </a>
          <h1 className="text-2xl font-bold">{artifact.title}</h1>
          <Badge>{artifact.documentId}</Badge>
          <Badge variant="outline">{artifact.status}</Badge>
        </div>
        <Button variant="outline" onClick={handleExport}>
          Export .md
        </Button>
      </div>

      <div className="rounded-md border p-6 bg-muted/50">
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {artifact.content}
        </pre>
      </div>
    </div>
  );
}
