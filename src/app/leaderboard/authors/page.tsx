/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import styles from "./leaderboard.module.css";

import { getVerifiedWorks, syncWorksFromChain, type Work } from "@/lib/workStore";
import { loadProfile } from "@/lib/profileStore";
import { canUseWorkVote, getVoteCountForWork } from "@/lib/workVoteChain";
import { useSuiClient } from "@mysten/dapp-kit";

type AuthorRow = {
  authorId: string;
  authorName: string;
  totalVotes: number;
  worksCount: number;
  topWorkTitle: string;
  topWorkVotes: number;
};

function looksLikeId(value: string) {
  const v = value.trim();
  if (!v) return false;
  if (v.includes("@")) return true;
  if (v.startsWith("0x") && v.length >= 20) return true;
  return false;
}

function resolveAuthorName(authorId: string, fallback?: string) {
  const p = authorId ? loadProfile(authorId) : {};
  const name = String(p?.name || fallback || "").trim();
  if (!name || looksLikeId(name)) return "Unknown";
  return name;
}

export default function AuthorLeaderboardPage() {
  const suiClient = useSuiClient();
  const [rows, setRows] = useState<AuthorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [works, setWorks] = useState<Work[]>(
    () => (getVerifiedWorks() as unknown as Work[]) || []
  );

  useEffect(() => {
    syncWorksFromChain();
    const onUpdate = () => {
      setWorks((getVerifiedWorks() as unknown as Work[]) || []);
    };
    window.addEventListener("works_updated", onUpdate);
    return () => window.removeEventListener("works_updated", onUpdate);
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!canUseWorkVote()) {
        // still show list without votes
        const byAuthor: Record<string, AuthorRow> = {};
        for (const w of works) {
          const authorId = String(w.authorId || "").trim();
          const key = authorId || "unknown";
          if (!byAuthor[key]) {
            byAuthor[key] = {
              authorId: authorId || "unknown",
              authorName: resolveAuthorName(authorId, w.authorName),
              totalVotes: 0,
              worksCount: 0,
              topWorkTitle: w.title || "Untitled",
              topWorkVotes: 0,
            };
          }
          byAuthor[key].worksCount += 1;
        }
        const list = Object.values(byAuthor).sort((a, b) => b.worksCount - a.worksCount);
        if (alive) setRows(list);
        return;
      }

      setLoading(true);
      const voteMap: Record<string, number> = {};

      const ids = works.map((w) => String(w.id || "").trim()).filter(Boolean);
      const CONC = 6;
      let i = 0;

      async function worker() {
        while (alive) {
          const idx = i++;
          if (idx >= ids.length) break;
          const id = ids[idx];
          const n = await getVoteCountForWork({ suiClient: suiClient as any, workId: id });
          voteMap[id] = n;
          await new Promise((r) => setTimeout(r, 40));
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, () => worker()));
      if (!alive) return;

      const byAuthor: Record<string, AuthorRow> = {};
      for (const w of works) {
        const authorId = String(w.authorId || "").trim();
        const key = authorId || "unknown";
        const votes = Number(voteMap[w.id] ?? 0);
        if (!byAuthor[key]) {
          byAuthor[key] = {
            authorId: authorId || "unknown",
            authorName: resolveAuthorName(authorId, w.authorName),
            totalVotes: 0,
            worksCount: 0,
            topWorkTitle: w.title || "Untitled",
            topWorkVotes: votes,
          };
        }
        const row = byAuthor[key];
        row.totalVotes += votes;
        row.worksCount += 1;
        if (votes > row.topWorkVotes) {
          row.topWorkVotes = votes;
          row.topWorkTitle = w.title || "Untitled";
        }
      }

      const list = Object.values(byAuthor).sort((a, b) => {
        if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
        return b.worksCount - a.worksCount;
      });

      if (alive) setRows(list);
      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [works, suiClient]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Author leaderboard</h1>
            <p className={styles.subtitle}>
              Ranked by total on-chain votes for verified works.
            </p>
            {!canUseWorkVote() && (
              <p className={styles.warn}>⚠️ WORK_VOTE env not configured -&gt; votes = 0</p>
            )}
          </div>
          {loading ? <span className={styles.loading}>Loading...</span> : null}
        </header>

        {rows.length === 0 ? (
          <div className={styles.empty}>No leaderboard data yet.</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.thead}>
              <div>#</div>
              <div>Author</div>
              <div>Works</div>
              <div>Total votes</div>
              <div>Top work</div>
            </div>
            {rows.map((r, idx) => (
              <div key={`${r.authorId}-${idx}`} className={styles.row}>
                <div className={styles.rank}>{idx + 1}</div>
                <div className={styles.author}>{r.authorName}</div>
                <div className={styles.cell}>{r.worksCount}</div>
                <div className={styles.cell}>{r.totalVotes}</div>
                <div className={styles.topWork}>
                  <span className={styles.topTitle}>{r.topWorkTitle}</span>
                  <span className={styles.topVotes}>+{r.topWorkVotes}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
