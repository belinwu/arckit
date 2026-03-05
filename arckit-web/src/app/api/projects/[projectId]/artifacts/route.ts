import { NextResponse } from "next/server";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const results = db.select().from(artifacts).where(eq(artifacts.projectId, projectId)).all();
  return NextResponse.json({ artifacts: results });
}
