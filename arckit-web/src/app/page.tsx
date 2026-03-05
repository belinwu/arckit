"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasApiKey } from "@/lib/api-key-store";
import { ProjectList } from "@/components/project-list";
import { CreateProjectDialog } from "@/components/create-project-dialog";

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasApiKey()) {
      router.replace("/setup");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your architecture governance projects
          </p>
        </div>
        <CreateProjectDialog />
      </div>
      <ProjectList />
    </main>
  );
}
