"use client";

import { useEffect, useState } from "react";
import {
  getPendingWorks,
  approveWork,
  rejectWork,
} from "@/lib/workStore";

export default function WorkReviewTable() {
  const [works, setWorks] = useState<any[]>([]);

  function load() {
    setWorks(getPendingWorks());
  }

  useEffect(() => {
    load();
    window.addEventListener("review-log-updated", load);
    return () =>
      window.removeEventListener(
        "review-log-updated",
        load
      );
  }, []);

  if (!works.length)
    return <p>Không còn tác phẩm chờ duyệt</p>;

  return (
    <table>
      <tbody>
        {works.map((w) => (
          <tr key={w.id}>
            <td>{w.title}</td>
            <td>
              {Object.values(w.approvalMap).reduce(
                (a, b) => a + b,
                0
              )}{" "}
              / {w.quorumWeight}
            </td>
            <td>
              <button
                onClick={() => approveWork(w.id)}
              >
                Approve
              </button>
              <button
                onClick={() =>
                  rejectWork(w.id, "Rejected")
                }
              >
                Reject
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
