"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasApiKey } from "@/lib/api-key-store";
import { getProject, getArtifacts, type Artifact } from "@/lib/store";
import { CommandPicker } from "@/components/command-picker";
import { CommandRunner } from "@/components/command-runner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText } from "lucide-react";

interface SelectedCommand {
  name: string;
  description: string;
  argumentHint?: string;
}

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] =
    useState<SelectedCommand | null>(null);

  useEffect(() => {
    if (!hasApiKey()) {
      router.replace("/setup");
      return;
    }

    const project = getProject(projectId);
    if (!project) {
      setError("Project not found");
      setLoading(false);
      return;
    }

    setProjectName(project.displayName);
    setArtifacts(getArtifacts(projectId));
    setLoading(false);
  }, [projectId, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
      </main>
    );
  }

  if (error || !projectName) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error || "Project not found"}
        </div>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4" />
            Back to projects
          </Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ArrowLeft className="size-4" />
            Projects
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {projectName}
          </h1>
          <Badge variant="secondary">{projectId}</Badge>
        </div>

        {/* Artifact badges */}
        {artifacts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {artifacts.map((a) => (
              <Badge key={a.documentId} variant="outline" className="text-xs">
                <FileText className="mr-1 size-3" />
                {a.documentId}
              </Badge>
            ))}
          </div>
        )}
        {artifacts.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No artifacts yet. Run a command to generate your first artifact.
          </p>
        )}
      </div>

      <Separator className="mb-6" />

      {/* Two-panel layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left panel: command picker */}
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2">
            <h2 className="text-sm font-medium">Commands</h2>
          </div>
          <div className="h-[calc(100vh-340px)] min-h-[400px]">
            <CommandPicker
              onSelect={(cmd) => setSelectedCommand(cmd)}
              selected={selectedCommand?.name}
            />
          </div>
        </div>

        {/* Right panel: command runner */}
        <div className="rounded-lg border">
          {selectedCommand ? (
            <div className="h-[calc(100vh-340px)] min-h-[400px]">
              <CommandRunner
                key={selectedCommand.name}
                commandName={selectedCommand.name}
                commandDescription={selectedCommand.description}
                argumentHint={selectedCommand.argumentHint}
                projectId={projectId}
              />
            </div>
          ) : (
            <div className="flex h-[calc(100vh-340px)] min-h-[400px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">Select a command</p>
                <p className="mt-1 text-sm">
                  Choose a command from the list to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
