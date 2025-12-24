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

  socials?: SocialLinks;
  options?: ProfileOptions;
};

function getKey(userId: string) {
  return `${KEY}:${userId}`;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
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

  return out;
}

function safeParseProfile(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!isPlainObject(v)) return null;

    // normalize: đảm bảo socials/options là object nếu có
    const p: UserProfile = { ...v };
    if (p.socials && !isPlainObject(p.socials)) delete (p as any).socials;
    if (p.options && !isPlainObject(p.options)) delete (p as any).options;

    return p;
  } catch {
    return null;
  }
}

export function loadProfile(userId: string): UserProfile {
  if (typeof window === "undefined") return {};
  if (!userId) return {};

  const newKey = getKey(userId);
  const oldKey = `${KEY}_${userId}`;

  try {
    const pNew = safeParseProfile(localStorage.getItem(newKey));
    if (pNew) return pNew;

    const rawOld = localStorage.getItem(oldKey);
    const pOld = safeParseProfile(rawOld);
    if (pOld && rawOld) {
      // migrate old -> new
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
 * ✅ saveProfile(userId, data)
 * - mặc định MERGE với profile hiện tại để không mất field
 * - vẫn dispatch event same-tab
 */
export function saveProfile(userId: string, data: UserProfile) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  try {
    const current = loadProfile(userId);
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
    localStorage.removeItem(`${KEY}_${userId}`);
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { userId } })
    );
  } catch {}
}

/**
 * clearAllProfiles:
 * - xoá hết key profile
 * - (tuỳ) có thể bắn 1 event chung để UI refresh nếu bạn muốn
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
 * ✅ subscribeProfile(userId, cb)
 * - nghe PROFILE_UPDATED_EVENT (same tab)
 * - nghe storage event (other tabs)
 * - gọi cb lần đầu để sync UI ngay
 * - debounce nhẹ để tránh spam setState
 */
export function subscribeProfile(userId: string, cb: (p: UserProfile) => void) {
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

    // nếu notify "*" (clearAllProfiles notify) thì cũng reload
    if (changedId !== userId && changedId !== "*") return;
    emit();
  };

  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key !== getKey(userId) && e.key !== `${KEY}_${userId}`) return;
    emit();
  };

  window.addEventListener(PROFILE_UPDATED_EVENT, onLocal as any);
  window.addEventListener("storage", onStorage);

  // sync ngay lúc subscribe
  emit();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener(PROFILE_UPDATED_EVENT, onLocal as any);
    window.removeEventListener("storage", onStorage);
  };
}
