"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getVerifiedWorks, syncWorksFromChain } from "@/lib/workStore";
import { useSyncWorkOwner } from "@/hooks/useSyncWorkOwner";
import { explorerObjectUrl, shortAddr } from "@/lib/suiExplorer";
import styles from "./marketplace.module.css";

type Filter = "all" | "exclusive" | "license";

export default function MarketplacePage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [list, setList] = useState<any[]>([]);

  function load() {
    const works = getVerifiedWorks();
    const filtered =
      filter === "all" ? works : works.filter(w => w.sellType === filter);
    setList(filtered);
  }

  useEffect(() => {
    syncWorksFromChain();
    load();
    window.addEventListener("works_updated", load);
    return () => window.removeEventListener("works_updated", load);
  }, [filter]);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Marketplace</h1>
          <p className={styles.subtitle}>Approved works + NFT ownership realtime</p>
        </div>

        <div className={styles.filters}>
          {(["all", "exclusive", "license"] as Filter[]).map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Tất cả" : f === "exclusive" ? "Bán đứt" : "License"}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {list.map(w => (
          <MarketCard key={w.id} work={w} />
        ))}
      </div>
    </main>
  );
}

function MarketCard({ work }: { work: any }) {
  // ✅ auto sync owner -> workStore.authorWallet
  const { owner } = useSyncWorkOwner({ workId: work.id, nftObjectId: work.nftObjectId });

  return (
    <div className={styles.card}>
      <div className={styles.badges}>
        <span className={styles.badge}>{work.sellType}</span>
        <span className={styles.badgeSoft}>{work.status}</span>
      </div>

      <h3 className={styles.cardTitle}>{work.title}</h3>

      <div className={styles.meta}>
        <div>
          <span className={styles.metaLabel}>Owner</span>
          <span className={styles.metaValue}>{shortAddr(owner ?? work.authorWallet)}</span>
        </div>

        {work.nftObjectId && (
          <a
            className={styles.metaLink}
            href={explorerObjectUrl(work.nftObjectId)}
            target="_blank"
            rel="noreferrer"
          >
            View NFT
          </a>
        )}
      </div>

      <div className={styles.actions}>
        <Link className={styles.primaryBtn} href={`/marketplace/${work.id}`}>
          Xem chi tiết
        </Link>
      </div>
    </div>
  );
}
