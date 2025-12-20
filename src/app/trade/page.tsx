"use client";

import { useEffect, useState } from "react";
import {
  getWorks,
  tradeWork,
  Work,
} from "@/lib/workStore";

export default function TradePage() {
  const [works, setWorks] = useState<Work[]>([]);

  useEffect(() => {
    setWorks(
      getWorks().filter(
        (w) => w.status === "verified"
      )
    );
  }, []);

  const trade = (id: string) => {
    tradeWork(id);
    setWorks(
      getWorks().filter(
        (w) => w.status === "verified"
      )
    );
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Giao dịch bản quyền</h1>

      {works.map((w) => (
        <div key={w.id} style={{ marginBottom: 12 }}>
          <b>{w.title}</b> – {w.author}
          <br />
          <button onClick={() => trade(w.id)}>
            Giao dịch
          </button>
        </div>
      ))}

      {works.length === 0 && (
        <p>Không có tác phẩm đủ điều kiện giao dịch</p>
      )}
    </div>
  );
}
