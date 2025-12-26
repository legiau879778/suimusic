import { promises as fs } from "fs";
import path from "path";
import { ProofRecord } from "./proofTypes";

const DATA_DIR = path.join(process.cwd(), "data");
const PROOF_FILE = path.join(DATA_DIR, "legal_proofs.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<ProofRecord[]> {
  try {
    const raw = await fs.readFile(PROOF_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(list: ProofRecord[]) {
  await ensureDir();
  await fs.writeFile(PROOF_FILE, JSON.stringify(list, null, 2), "utf8");
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `proof_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function createProof(
  data: Omit<ProofRecord, "id" | "createdAt">
) {
  const list = await readAll();
  const record: ProofRecord = {
    id: newId(),
    createdAt: new Date().toISOString(),
    ...data,
  };
  list.push(record);
  await writeAll(list);
  return record;
}

export async function updateProof(
  id: string,
  patch: Partial<ProofRecord>
) {
  const list = await readAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  await writeAll(list);
  return list[idx];
}

export async function getProof(id: string) {
  const list = await readAll();
  return list.find((p) => p.id === id) || null;
}
