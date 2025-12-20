"use client";

import { useEffect, useState } from "react";
import { getWorks, Work } from "@/lib/workStore";

export default function ManagePage() {
  const [works, setWorks] = useState<Work[]>([]);

  useEffect(() => {
    setWorks(getWorks());
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Quản lý tác phẩm</h1>

      {works.map(w => (
        <div key={w.id} style={{ marginBottom: 12 }}>
          <strong>{w.title}</strong> – {w.status}
          <br />
          Hash: {w.fileHash}
          {w.txHash && (
            <>
              <br />
              Tx: {w.txHash}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
