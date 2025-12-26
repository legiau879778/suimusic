const KEY = "chainstorm_profile";

/** ✅ event bắn khi profile thay đổi (same-tab) */
export const PROFILE_UPDATED_EVENT = "chainstorm_profile_updated";

export type SocialLinks = {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
};

export type ProfileOptions = {
  publicProfile?: boolean;
  showSocials?: boolean;
  allowEmailContact?: boolean;
};

export type UserProfile = {
  name?: string;
  phone?: string;
  cccd?: string;
  dob?: string;
  email?: string;
  country?: string;
  address?: string;

  walletAddress?: string;

  /** ✅ avatar URL: http/https hoặc walrus:ID */
  avatar?: string;

  socials?: SocialLinks;
  options?: ProfileOptions;
  membership?: "Free" | "Starter" | "Pro" | "Studio" | string;
};

function getKey(userId: string) {
  return `${KEY}:${userId}`;
}

function getOldKey(userId: string) {
  return `${KEY}_${userId}`;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function safeTrim(v: any) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t;
}

/** ✅ helper normalize walrus -> gateway (chỉ dùng Walrus) */
export function toGateway(input?: string) {
  if (typeof input !== "string") return "";
  const v = input.trim();
  if (!v) return "";

  // URL đầy đủ
  if (v.startsWith("http://") || v.startsWith("https://")) return v;

  if (v.startsWith("/api/walrus/blob/")) return v;
  // walrus:ID hoặc walrus://ID
  if (v.startsWith("walrus:")) {
    return `/api/walrus/blob/${v.replace("walrus:", "")}`;
  }
  if (v.startsWith("walrus://")) {
    return `/api/walrus/blob/${v.replace("walrus://", "")}`;
  }
  return "";
}

/** merge sâu tối thiểu cho profile (tránh mất socials/options khi update 1 phần) */
function mergeProfile(base: UserProfile, patch: UserProfile): UserProfile {
  const out: UserProfile = { ...(base || {}), ...(patch || {}) };

  // deep merge socials/options
  if (isPlainObject(base?.socials) || isPlainObject(patch?.socials)) {
    out.socials = { ...(base?.socials || {}), ...(patch?.socials || {}) };
  }
  if (isPlainObject(base?.options) || isPlainObject(patch?.options)) {
    out.options = { ...(base?.options || {}), ...(patch?.options || {}) };
  }

  // normalize string fields (trim)
  (Object.keys(out) as (keyof UserProfile)[]).forEach((k) => {
    // @ts-ignore
    out[k] = safeTrim(out[k]);
  });

  // normalize avatar: cho phép walrus: hoặc http(s)
  if (out.avatar) out.avatar = String(out.avatar).trim();

  return out;
}

function safeParseProfile(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!isPlainObject(v)) return null;

    const p: UserProfile = { ...v };

    // normalize: đảm bảo socials/options là object nếu có
    if (p.socials && !isPlainObject(p.socials)) delete (p as any).socials;
    if (p.options && !isPlainObject(p.options)) delete (p as any).options;

    // trim strings
    (Object.keys(p) as (keyof UserProfile)[]).forEach((k) => {
      // @ts-ignore
      p[k] = safeTrim(p[k]);
    });

    return p;
  } catch {
    return null;
  }
}

/**
 * ✅ loadProfile(userId)
 * - đọc key mới trước
 * - nếu có key cũ -> migrate
 * - nếu lỡ tồn tại cả 2 -> merge (tránh mất field)
 */
export function loadProfile(userId: string): UserProfile {
  if (typeof window === "undefined") return {};
  if (!userId) return {};

  const newKey = getKey(userId);
  const oldKey = getOldKey(userId);

  try {
    const rawNew = localStorage.getItem(newKey);
    const rawOld = localStorage.getItem(oldKey);

    const pNew = safeParseProfile(rawNew);
    const pOld = safeParseProfile(rawOld);

    // case: có cả 2 -> merge và lưu về key mới
    if (pNew && pOld) {
      const merged = mergeProfile(pOld, pNew); // new override old
      localStorage.setItem(newKey, JSON.stringify(merged));
      localStorage.removeItem(oldKey);
      return merged;
    }

    // case: chỉ có new
    if (pNew) return pNew;

    // case: chỉ có old -> migrate
    if (pOld && rawOld) {
      localStorage.setItem(newKey, rawOld);
      localStorage.removeItem(oldKey);
      return pOld;
    }

    return {};
  } catch {
    // nếu storage bị lỗi/quota/corrupt -> dọn
    try {
      localStorage.removeItem(newKey);
      localStorage.removeItem(oldKey);
    } catch {}
    return {};
  }
}

/**
 * ✅ saveProfile(userId, data, options?)
 * - mặc định MERGE với profile hiện tại để không mất field
 * - options.replace=true => ghi đè hoàn toàn (ít dùng)
 * - vẫn dispatch event same-tab
 */
export function saveProfile(
  userId: string,
  data: UserProfile,
  options: { replace?: boolean } = {}
) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  try {
    const current = options.replace ? ({} as UserProfile) : loadProfile(userId);
    const merged = mergeProfile(current, data);

    localStorage.setItem(getKey(userId), JSON.stringify(merged));

    // ✅ same-tab notify
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { userId } })
    );
  } catch {}
}

export function clearProfile(userId: string) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  try {
    localStorage.removeItem(getKey(userId));
    localStorage.removeItem(getOldKey(userId));
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { userId } })
    );
  } catch {}
}

/**
 * clearAllProfiles:
 * - xoá hết key profile
 * - (tuỳ) notify "*" để UI reload
 */
export function clearAllProfiles({ notify = false }: { notify?: boolean } = {}) {
  if (typeof window === "undefined") return;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`${KEY}:`) || k.startsWith(`${KEY}_`)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));

    if (notify) {
      window.dispatchEvent(
        new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { userId: "*" } })
      );
    }
  } catch {}
}

/**
 * ✅ subscribeProfile(userId, cb, options?)
 * - nghe PROFILE_UPDATED_EVENT (same tab)
 * - nghe storage event (other tabs)
 * - gọi cb lần đầu để sync UI ngay
 * - debounce nhẹ để tránh spam setState
 */
export function subscribeProfile(
  userId: string,
  cb: (p: UserProfile) => void,
  options?: { listenAll?: boolean }
) {
  if (typeof window === "undefined") return () => {};
  if (!userId) return () => {};

  let raf = 0;
  const emit = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => cb(loadProfile(userId)));
  };

  const onLocal = (ev: Event) => {
    const anyEv = ev as any;
    const changedId = anyEv?.detail?.userId as string | undefined;

    if (changedId === userId) return emit();

    // ✅ nếu notify "*" và listenAll=true thì reload
    if (options?.listenAll && changedId === "*") return emit();
  };

  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    const KEY = "chainstorm_profile";
    const newKey = `${KEY}:${userId}`;
    const oldKey = `${KEY}_${userId}`;
    if (e.key !== newKey && e.key !== oldKey) return;
    emit();
  };

  window.addEventListener(PROFILE_UPDATED_EVENT, onLocal as any);
  window.addEventListener("storage", onStorage);

  emit();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener(PROFILE_UPDATED_EVENT, onLocal as any);
    window.removeEventListener("storage", onStorage);
  };
}

// ===== FIND PROFILE (scan localStorage) =====

export function findProfileByEmail(email?: string) {
  if (typeof window === "undefined") return null;
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // key dạng chainstorm_profile:<id>
      if (!k.startsWith(`${KEY}:`)) continue;

      const raw = localStorage.getItem(k);
      const p = safeParseProfile(raw);
      if (!p) continue;

      if (String(p.email || "").trim().toLowerCase() === target) {
        const userId = k.replace(`${KEY}:`, "");
        return { userId, profile: p as UserProfile };
      }
    }
  } catch {}

  return null;
}

export function findProfileByWallet(wallet?: string) {
  if (typeof window === "undefined") return null;
  const target = String(wallet || "").trim().toLowerCase();
  if (!target) return null;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      if (!k.startsWith(`${KEY}:`)) continue;

      const raw = localStorage.getItem(k);
      const p = safeParseProfile(raw);
      if (!p) continue;

      if (String(p.walletAddress || "").trim().toLowerCase() === target) {
        const userId = k.replace(`${KEY}:`, "");
        return { userId, profile: p as UserProfile };
      }
    }
  } catch {}

  return null;
}
