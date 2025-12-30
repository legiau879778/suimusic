"use client";

import { useNFTOwnership } from "@/hooks/useNFTOwnership";

export default function WorkDetailModal({
  work,
  onClose,
}: {
  work: any;
  onClose: () => void;
}) {
  const { owner, loading } =
    useNFTOwnership(work.nftObjectId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111",
          padding: 24,
          margin: "10% auto",
          width: 400,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2>{work.title}</h2>
        <p>
          <strong>Author:</strong> {work.authorName || work.authorId}
        </p>
        <p>
          <strong>Genre:</strong> {work.category || "Not specified"}
        </p>
        <p>
          <strong>Language:</strong> {work.language || "Not specified"}
        </p>
        <p>
          <strong>Status:</strong> {work.status}
        </p>
        <p>
          Owner:{" "}
          {loading ? "sync..." : owner}
        </p>

        <h4>Licenses</h4>
        {work.licenses.map((l: any, i: number) => (
          <div key={i}>
            {l.licensee.slice(0, 6)}… ·{" "}
            {l.royalty}%
          </div>
        ))}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
