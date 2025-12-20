// src/lib/stats.ts

import { getWorks } from "@/lib/workStore";
import type { WorkStatus, TradeStatus } from "@/lib/workStore";

/**
 * Thống kê tổng quan hệ thống tác phẩm
 * - WorkStatus: pending | verified | rejected
 * - Traded: tác phẩm có ít nhất 1 trade status === "accepted"
 */
export function getWorkStats() {
  const works = getWorks();

  const pending = works.filter(w => w.status === "pending").length;
  const verified = works.filter(w => w.status === "verified").length;
  const rejected = works.filter(w => w.status === "rejected").length;

  // ✅ traded KHÔNG phải WorkStatus
  // Một tác phẩm được coi là traded nếu có ít nhất 1 trade accepted
  const traded = works.filter(w =>
    w.trades.some(t => t.status === "accepted")
  ).length;

  return {
    works: {
      total: works.length,
      pending,
      verified,
      rejected,
      traded,
    },
  };
}

/**
 * Thống kê chi tiết theo trạng thái giao dịch
 */
export function getTradeStats() {
  const works = getWorks();

  let pending = 0;
  let accepted = 0;
  let rejected = 0;

  works.forEach(w => {
    w.trades.forEach(t => {
      if (t.status === "pending") pending++;
      if (t.status === "accepted") accepted++;
      if (t.status === "rejected") rejected++;
    });
  });

  return {
    trades: {
      pending,
      accepted,
      rejected,
      total: pending + accepted + rejected,
    },
  };
}

/**
 * Thống kê tác phẩm theo marketStatus
 */
export function getMarketStats() {
  const works = getWorks();

  return {
    market: {
      private: works.filter(w => w.marketStatus === "private").length,
      public: works.filter(w => w.marketStatus === "public").length,
      tradeable: works.filter(w => w.marketStatus === "tradeable").length,
    },
  };
}
