import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { slugify } from "@/lib/doc-id";

export async function GET() {
  const allProjects = db.select().from(projects).all();
  return NextResponse.json({ projects: allProjects });
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const slug = slugify(name);
  const now = new Date().toISOString();

  // Find next project ID
  const existing = db.select().from(projects).all();
  const maxId = existing.reduce((max, p) => {
    const num = parseInt(p.projectId, 10);
    return num > max ? num : max;
  }, 0);
  const projectId = String(maxId + 1).padStart(3, "0");

  db.insert(projects).values({
    projectId,
    name: slug,
    slug,
    displayName: name,
    createdAt: now,
    updatedAt: now,
  }).run();

  return NextResponse.json({ projectId, slug, displayName: name }, { status: 201 });
}
