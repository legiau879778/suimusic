"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import {
  getActiveMembership,
  type Membership,
  getMembershipBadgeLabel,
  getMembershipEntitlements,
} from "@/lib/membershipStore";

const items = [
  { id: "membership", label: "Membership", icon: "fa-id-card" },
  { id: "info", label: "Thông tin cá nhân", icon: "fa-user" },
  { id: "history", label: "Lịch sử giao dịch", icon: "fa-clock" },
  { id: "settings", label: "Cài đặt", icon: "fa-gear" },
] as const;

function formatCountdown(ms: number) {
  if (ms <= 0) return "Hết hạn";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d} ngày ${h}h ${m}m ${s}s`;
}

export default function ProfileSidebar({
  active,
  onChange,
}: {
  active: string;
  onChange: (v: any) => void;
}) {
  const { logout, user } = useAuth();

  const roleLabel = useMemo(() => {
    if (user?.role === "admin") return "Quản trị viên";
    if (user?.role === "author") return "Tác giả";
    return "Người dùng";
  }, [user?.role]);

  // ✅ nếu bạn muốn CHỈ hiện badge khi đang ở tab membership
  const shouldShowBadge = active === "membership";

  const userId = useMemo(
    () => user?.id || user?.email || "",
    [user?.id, user?.email]
  );

  const [membership, setMembership] = useState<Membership | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!shouldShowBadge) return;

    let alive = true;
    (async () => {
      if (!userId) {
        setMembership(null);
        return;
      }
      const m = await getActiveMembership(userId);
      if (alive) setMembership(m);
    })();

    return () => {
      alive = false;
    };
  }, [userId, shouldShowBadge]);

  useEffect(() => {
    if (!shouldShowBadge) return;

    if (!membership) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const diff = membership.expireAt - Date.now();
      if (diff <= 0) {
        setMembership(null);
        setCountdown("");
        return;
      }
      setCountdown(formatCountdown(diff));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [membership, shouldShowBadge]);

  const ent = useMemo(
    () => getMembershipEntitlements(membership),
    [membership]
  );

  return (
    <aside className={styles.sidebar}>
      {/* TOP */}
      <div>
        <div className={styles.avatarBlock}>
          <div className={styles.avatarCircle}>
            {user?.email?.[0]?.toUpperCase() || "U"}
          </div>

          <span className={styles.userId}>{user?.email || "—"}</span>
          <span className={styles.userRoleHint}>{roleLabel}</span>

          {/* Badge chỉ hiện khi đang ở tab Membership */}
          {shouldShowBadge && (
            <div className={styles.sideBadgeWrap}>
              {membership ? (
                <div className={styles.sideBadgeOk}>
                  <div className={styles.sideBadgeTitle}>
                    {getMembershipBadgeLabel(membership)}
                  </div>
                  <div className={styles.sideBadgeSub}>
                    Còn lại: {countdown || "—"}
                  </div>
                  <div className={styles.sideBadgeSub}>
                    Mở khóa menu:{" "}
                    <strong>
                      {ent.canManage || ent.canRegister || ent.canTrade
                        ? [
                            ent.canManage ? "Manage" : null,
                            ent.canRegister ? "Register" : null,
                            ent.canTrade ? "Trade" : null,
                          ]
                            .filter(Boolean)
                            .join(" / ")
                        : "—"}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className={styles.sideBadgeWarn}>
                  <div className={styles.sideBadgeTitleWarn}>CHƯA CÓ</div>
                  <div className={styles.sideBadgeSub}>
                    Chọn gói để mở khóa tính năng
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className={styles.sideNav}>
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => onChange(i.id)}
              className={`${styles.sideBtn} ${
                active === i.id ? styles.sideActive : ""
              }`}
            >
              <i className={`fa-solid ${i.icon}`} />
              {i.label}
            </button>
          ))}
        </nav>
      </div>

      {/* BOTTOM (đúng UX: logout nằm dưới) */}
      <button type="button" className={styles.logoutBtn} onClick={logout}>
        <i className="fa-solid fa-right-from-bracket" />
        Đăng xuất
      </button>
    </aside>
  );
}
