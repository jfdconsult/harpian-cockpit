import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "jim-sessions");

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  model?: string;
  tokens?: { input: number; output: number };
  greeting?: boolean;
  screen?: string;
}

export interface JimSession {
  id: string;
  messages: SessionMessage[];
  createdAt: number;
  updatedAt: number;
  screens: string[];
}

const MAX_MESSAGES = 200;

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function sessionPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function loadSession(id: string): Promise<JimSession | null> {
  try {
    const raw = await fs.readFile(sessionPath(id), "utf-8");
    return JSON.parse(raw) as JimSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: JimSession): Promise<void> {
  await ensureDir();
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  session.updatedAt = Date.now();
  await fs.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf-8");
}

export async function clearSession(id: string): Promise<void> {
  try {
    await fs.unlink(sessionPath(id));
  } catch {}
}
