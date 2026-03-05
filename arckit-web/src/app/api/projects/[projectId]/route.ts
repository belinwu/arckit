import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, artifacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = db.select().from(projects).where(eq(projects.projectId, projectId)).get();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectArtifacts = db.select().from(artifacts).where(eq(artifacts.projectId, projectId)).all();

  return NextResponse.json({ project, artifacts: projectArtifacts });
}
