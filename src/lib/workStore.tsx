export type WorkStatus = "pending" | "verified" | "rejected" | "traded";

export type TxEvent = {
  type: "REGISTER" | "VERIFY" | "TRADE";
  txHash?: string;
  time: number;
};

export type Work = {
  id: string;
  title: string;
  authorId: string;
  fileHash: string;
  status: WorkStatus;
  history: TxEvent[];
};

const KEY = "works";

function safeLoad(): Work[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function safeSave(data: Work[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getWorks(): Work[] {
  return safeLoad();
}

export function countWorksByAuthor(authorId: string): number {
  return safeLoad().filter(w => w.authorId === authorId).length;
}

export function addWork(data: {
  title: string;
  authorId: string;
  fileHash: string;
}) {
  const works = safeLoad();
  works.push({
    id: crypto.randomUUID(),
    title: data.title,
    authorId: data.authorId,
    fileHash: data.fileHash,
    status: "pending",
    history: [{ type: "REGISTER", time: Date.now() }],
  });
  safeSave(works);
}

export function verifyWork(id: string) {
  safeSave(
    safeLoad().map(w =>
      w.id === id
        ? {
            ...w,
            status: "verified",
            history: [
              ...w.history,
              { type: "VERIFY", txHash: "0x" + Date.now(), time: Date.now() },
            ],
          }
        : w
    )
  );
}

export function tradeWork(id: string, buyer?: string) {
  safeSave(
    safeLoad().map(w =>
      w.id === id
        ? {
            ...w,
            status: "traded",
            history: [
              ...w.history,
              {
                type: "TRADE",
                txHash: "0xTRADE_" + Date.now(),
                time: Date.now(),
              },
            ],
          }
        : w
    )
  );
}
