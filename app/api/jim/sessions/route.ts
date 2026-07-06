import { NextRequest, NextResponse } from "next/server";
import { loadSession, saveSession, clearSession, type JimSession, type SessionMessage } from "@/lib/jim-sessions";

export const dynamic = "force-dynamic";

const DEFAULT_SESSION = "default";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || DEFAULT_SESSION;
  const session = await loadSession(id);
  if (!session) {
    return NextResponse.json({ id, messages: [], screens: [] });
  }
  return NextResponse.json(session);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || DEFAULT_SESSION;
    const messages: SessionMessage[] = body.messages || [];
    const screens: string[] = body.screens || [];

    const session: JimSession = {
      id,
      messages,
      createdAt: body.createdAt || Date.now(),
      updatedAt: Date.now(),
      screens,
    };
    await saveSession(session);
    return NextResponse.json({ ok: true, count: messages.length });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || DEFAULT_SESSION;
  await clearSession(id);
  return NextResponse.json({ ok: true });
}
