"use client";

import { useEffect, useState } from "react";
import { getPendingWorks, Work } from "@/lib/workStore";
import WorkReviewTable from "@/components/admin/WorkReviewTable";
import WorkReviewModal from "@/components/admin/WorkReviewModal";

export default function AdminWorksPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [selected, setSelected] = useState<Work | null>(null);

  /* =====================
     LOAD PENDING WORKS
  ===================== */
  useEffect(() => {
    setWorks(getPendingWorks());

    function refresh() {
      setWorks(getPendingWorks());
    }

    window.addEventListener(
      "review-log-updated",
      refresh
    );

    return () =>
      window.removeEventListener(
        "review-log-updated",
        refresh
      );
  }, []);

  return (
    <>
      <h1>Duyệt tác phẩm</h1>

      <WorkReviewTable
        works={works}                 // ✅ TRUYỀN works
        onOpenReview={setSelected}    // ✅ TRUYỀN handler
      />

      {selected && (
        <WorkReviewModal
          work={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
