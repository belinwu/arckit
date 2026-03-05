import { NextResponse } from "next/server";
import { loadCommands } from "@/lib/commands";

export async function GET() {
  const commands = loadCommands().map(({ name, description, argumentHint, handoffs }) => ({
    name,
    description,
    argumentHint,
    handoffs,
  }));

  return NextResponse.json({ commands });
}
