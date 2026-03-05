import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { slugify } from "@/lib/doc-id";

export async function GET() {
  const allProjects = await db.select().from(projects);
  return NextResponse.json({ projects: allProjects });
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const slug = slugify(name);
  const now = new Date().toISOString();

  // Find next project ID
  const existing = await db.select().from(projects);
  const maxId = existing.reduce((max, p) => {
    const num = parseInt(p.projectId, 10);
    return num > max ? num : max;
  }, 0);
  const projectId = String(maxId + 1).padStart(3, "0");

  await db.insert(projects).values({
    projectId,
    name: slug,
    slug,
    displayName: name,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ projectId, slug, displayName: name }, { status: 201 });
}
