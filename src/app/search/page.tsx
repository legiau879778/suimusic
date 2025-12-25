"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./search.module.css";
import { getVerifiedWorks } from "@/lib/workStore";

/* profileStore */
import { loadProfile, type UserProfile, toGateway } from "@/lib/profileStore";

/* membershipStore */
import {
  type Membership,
  getActiveMembership,
  getCachedMembership,
  getMembershipBadgeLabel,
} from "@/lib/membershipStore";

/* ===== Phosphor Icons ===== */
import { MagnifyingGlass, UsersThree, ShieldCheck, ArrowRight } from "@phosphor-icons/react";

type Work = any;

type AuthorRow = {
  authorId: string;
  rep: Work; // work đại diện để fallback
};

type ViewModel = {
  authorId: string;
  name: string;
  email: string;
  avatar: string;
  membership: Membership | null;
};

function shortText(v?: string) {
  const s = (v || "").trim();
  return s || "—";
}

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** ưu tiên profileStore, fallback từ rep work */
function buildVM(authorId: string, rep: Work): ViewModel {
  const p: UserProfile = loadProfile(authorId) || {};

  const name =
    String(p?.name || "").trim() ||
    String(rep?.authorName || "").trim() ||
    "Tác giả";

  const email =
    String(p?.email || "").trim() ||
    String(rep?.authorEmail || rep?.email || "").trim() ||
    "—";

  const avatarRaw =
    String(p?.avatar || "").trim() ||
    String(rep?.authorAvatar || rep?.avatar || "").trim();

  const avatar = toGateway(avatarRaw);

  // membership: dùng cache trước để UI có ngay
  const cached = getCachedMembership(authorId, email);

  return {
    authorId,
    name,
    email,
    avatar,
    membership: cached || null,
  };
}

/** shallow compare 2 vmMap theo key + 4 fields cơ bản */
function sameVM(a: ViewModel, b: ViewModel) {
  const aKey = a.membership ? `${a.membership.type}:${a.membership.expireAt}` : "";
  const bKey = b.membership ? `${b.membership.type}:${b.membership.expireAt}` : "";
  return (
    a.authorId === b.authorId &&
    a.name === b.name &&
    a.email === b.email &&
    a.avatar === b.avatar &&
    aKey === bKey
  );
}

type VmMap = Record<string, ViewModel>;

export default function SearchPage() {
  /** ✅ QUAN TRỌNG: đóng băng works để không đổi reference mỗi render */
  const works = useMemo(() => getVerifiedWorks() as unknown as Work[], []);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const debouncedQ = useDebounce(q);

  /* ===== group works -> authors ===== */
  const authorRows = useMemo<AuthorRow[]>(() => {
    const map = new Map<string, Work>();

    for (const w of works) {
      const id = String(w?.authorId || "").trim();
      if (!id) continue;
      if (!map.has(id)) map.set(id, w);
    }

    const rows: AuthorRow[] = [];
    for (const [authorId, rep] of map.entries()) {
      rows.push({ authorId, rep });
    }

    // sort theo tên fallback (để UI ổn định)
    rows.sort((a, b) => {
      const pa = loadProfile(a.authorId) || {};
      const pb = loadProfile(b.authorId) || {};
      const na = String(pa?.name || a.rep?.authorName || a.authorId);
      const nb = String(pb?.name || b.rep?.authorName || b.authorId);
      return na.localeCompare(nb);
    });

    return rows;
  }, [works]);

  /** ✅ deps ổn định thay vì [authorRows] */
  const authorKey = useMemo(
    () => authorRows.map((x) => x.authorId).join("|"),
    [authorRows]
  );

  /** init vmMap 1 lần theo authorKey */
  const [vmMap, setVmMap] = useState<VmMap>(() => {
    const next: VmMap = {};
    for (const r of authorRows) next[r.authorId] = buildVM(r.authorId, r.rep);
    return next;
  });

  /** giữ ref để effect membership không cần deps vmMap */
  const vmRef = useRef(vmMap);
  useEffect(() => {
    vmRef.current = vmMap;
  }, [vmMap]);

  /** ✅ Sync profile/email/avatar khi authorKey thay đổi (không loop) */
  useEffect(() => {
    const next: VmMap = {};
    for (const r of authorRows) next[r.authorId] = buildVM(r.authorId, r.rep);

    setVmMap((prev) => {
      // nếu keys giống và từng item giống -> không setState
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length) {
        let allSame = true;
        for (const k of nextKeys) {
          const a = prev[k];
          const b = next[k];
          if (!a || !b || !sameVM(a, b)) {
            allSame = false;
            break;
          }
        }
        if (allSame) return prev;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorKey]);

  /** ===== FILTER ===== */
  const filtered = useMemo(() => {
    const k = debouncedQ.trim().toLowerCase();
    if (!k) return authorRows;

    return authorRows.filter((r) => {
      const vm = vmMap[r.authorId];
      const name = (vm?.name || "").toLowerCase();
      const email = (vm?.email || "").toLowerCase();
      const id = (r.authorId || "").toLowerCase();
      return name.includes(k) || email.includes(k) || id.includes(k);
    });
  }, [authorRows, debouncedQ, vmMap]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 160);
    return () => clearTimeout(t);
  }, [debouncedQ]);

  /** ===== membership truth (đúng “đã mua”) ===== */
  useEffect(() => {
    let alive = true;

    async function run() {
      // chạy nhẹ: chỉ resolve cho list đang hiển thị (tối đa 30)
      const list = filtered.slice(0, 30);

      for (const r of list) {
        if (!alive) return;

        const current = vmRef.current[r.authorId];
        if (!current) continue;

        // nếu email chưa có thì bỏ qua (không đoán)
        const email = String(current.email || "").trim();
        if (!email || email === "—") continue;

        try {
          const truth = await getActiveMembership({ userId: r.authorId, email });
          if (!alive) return;

          setVmMap((prev) => {
            const p = prev[r.authorId];
            if (!p) return prev;

            const prevKey = p.membership ? `${p.membership.type}:${p.membership.expireAt}` : "";
            const newKey = truth ? `${truth.type}:${truth.expireAt}` : "";
            if (prevKey === newKey) return prev;

            return { ...prev, [r.authorId]: { ...p, membership: truth } };
          });
        } catch {
          // ignore -> giữ cached/null
        }

        // delay nhỏ chống spam
        await new Promise((x) => setTimeout(x, 60));
      }
    }

    if (filtered.length > 0) run();

    return () => {
      alive = false;
    };
  }, [filtered]); // ✅ filtered thay đổi theo search, OK

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroIcon}>
              <UsersThree size={22} weight="fill" />
            </div>
            <div>
              <h1 className={styles.title}>Tra cứu tác giả</h1>
              <p className={styles.subtitle}>
                Hiển thị thông tin cơ bản (avatar, email, membership). Nhấn để xem chi tiết.
              </p>
            </div>
          </div>
        </section>

        {/* SEARCH */}
        <section className={styles.searchBox}>
          <div className={styles.searchWrap}>
            <MagnifyingGlass size={18} weight="bold" className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Tên tác giả / Email / ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </section>

        {/* GRID */}
        <section className={styles.grid}>
          {loading &&
            Array.from({ length: 8 }).map((_, i) => <div key={i} className={styles.skeleton} />)}

          {!loading &&
            filtered.map((r) => {
              const vm = vmMap[r.authorId];
              const name = vm?.name || "Tác giả";
              const email = vm?.email || "—";
              const avatar = vm?.avatar || "";
              const mem = vm?.membership;

              const memLabel = mem ? getMembershipBadgeLabel(mem) : "Free";

              return (
                <Link
                  key={r.authorId}
                  href={`/author/${encodeURIComponent(r.authorId)}`}
                  className={styles.authorCard}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.avatarRow}>
                      <div className={styles.avatarWrap}>
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatar} alt={name} className={styles.avatarImg} />
                        ) : (
                          <div className={styles.avatarFallback}>
                            {name?.[0]?.toUpperCase() || "A"}
                          </div>
                        )}
                      </div>

                      <div className={styles.badgeCol}>
                        <span className={styles.verifiedPill}>
                          <ShieldCheck size={14} weight="fill" /> Verified
                        </span>

                        <span className={styles.memberPill} data-tier={String(mem?.type || "").toLowerCase()}>
                          {memLabel}
                        </span>
                      </div>
                    </div>

                    <h3 className={styles.cardTitle}>{shortText(name)}</h3>

                    <div className={styles.emailRow}>{shortText(email)}</div>

                    <div className={styles.idRow}>
                      ID: <span className={styles.mono}>{r.authorId}</span>
                    </div>
                  </div>

                  <div className={styles.hoverCta}>
                    Xem chi tiết <ArrowRight size={16} weight="bold" />
                  </div>
                </Link>
              );
            })}

          {!loading && filtered.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>Không tìm thấy tác giả</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
