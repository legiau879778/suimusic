"use client"

import DashboardStats from "@/components/admin/DashboardStats";

export default function AdminPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>
        Dashboard quản trị
      </h1>

      <DashboardStats />
    </div>
  );
}
