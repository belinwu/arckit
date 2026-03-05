import { NextResponse } from "next/server";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const results = await db.select().from(artifacts).where(eq(artifacts.projectId, projectId));
  return NextResponse.json({ artifacts: results });
}
