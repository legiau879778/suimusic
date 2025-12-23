"use client";

import { useEffect, useState } from "react";
import {
  getPendingAuthors,
  approveAuthor,
  type Author,
} from "@/lib/authorStore";
import { signApproveAuthorMessage } from "@/lib/signApproveAuthorMessage";
import AdminGuard from "@/components/admin/AdminGuard";

export default function AdminAuthorReviewPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setAuthors(getPendingAuthors());
  }, []);

  async function handleApprove(authorId: string) {
    try {
      setLoadingId(authorId);

      const { adminWallet, signature } =
        await signApproveAuthorMessage(authorId);

      approveAuthor(authorId);

      console.log("Approved", {
        authorId,
        adminWallet,
        signature,
      });

      setAuthors(prev =>
        prev.filter(a => a.id !== authorId)
      );
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <AdminGuard>
      <main style={{ padding: 32 }}>
        <h1>Duyệt Author</h1>

        {authors.map(a => (
          <div key={a.id} style={{ marginTop: 16 }}>
            <strong>{a.stageName}</strong>
            <button
              onClick={() => handleApprove(a.id)}
              disabled={loadingId === a.id}
            >
              {loadingId === a.id
                ? "Đang ký ví..."
                : "Approve"}
            </button>
          </div>
        ))}
      </main>
    </AdminGuard>
  );
}
