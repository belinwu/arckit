import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, artifacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = await db.select().from(projects).where(eq(projects.projectId, projectId)).get();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectArtifacts = await db.select().from(artifacts).where(eq(artifacts.projectId, projectId));

  return NextResponse.json({ project, artifacts: projectArtifacts });
}
