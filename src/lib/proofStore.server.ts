import { promises as fs } from "fs";
import path from "path";
import { ProofRecord } from "./proofTypes";

function getDataDir() {
  if (process.env.LEGAL_PROOF_DIR) return process.env.LEGAL_PROOF_DIR;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless) {
    const tmp = process.env.WALRUS_MOCK_DIR || process.env.TMPDIR || "/tmp";
    return path.join(tmp, "suimusic_data");
  }
  return path.join(process.cwd(), "data");
}

function getProofFile() {
  return path.join(getDataDir(), "legal_proofs.json");
}

async function ensureDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

async function readAll(): Promise<ProofRecord[]> {
  try {
    const raw = await fs.readFile(getProofFile(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(list: ProofRecord[]) {
  await ensureDir();
  await fs.writeFile(getProofFile(), JSON.stringify(list, null, 2), "utf8");
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

export async function listProofs(status?: string) {
  const list = await readAll();
  if (!status) return list;
  return list.filter((p) => p.status === status);
}
