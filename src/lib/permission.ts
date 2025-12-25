// src/lib/profileStore.ts
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

  avatar?: string;

  socials?: SocialLinks;
  options?: ProfileOptions;
};

function getKey(userId: string) {
  return `${KEY}:${userId}`;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** normalize ipfs/cid/url -> gateway */
export function toGateway(urlOrCid?: string) {
  if (!urlOrCid) return "";
  const v = String(urlOrCid).trim();
  if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${v.replace("ipfs://", "")}`;
  // nếu đưa thẳng CID
  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

/** merge sâu tối thiểu cho profile (tránh mất socials/options khi update 1 phần) */
function mergeProfile(base: UserProfile, patch: UserProfile): UserProfile {
  const out: UserProfile = { ...(base || {}), ...(patch || {}) };

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
      localStorage.setItem(newKey, rawOld);
      localStorage.removeItem(oldKey);
      return pOld;
    }

    return {};
  } catch {
    try {
      localStorage.removeItem(newKey);
      localStorage.removeItem(oldKey);
    } catch {}
    return {};
  }
}

export function saveProfile(userId: string, data: UserProfile) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  try {
    const current = loadProfile(userId);
    const merged = mergeProfile(current, data);

    localStorage.setItem(getKey(userId), JSON.stringify(merged));

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

/** ✅ lấy tất cả profiles trong localStorage */
export function getAllProfiles(): Array<{ userId: string; profile: UserProfile }> {
  if (typeof window === "undefined") return [];

  const out: Array<{ userId: string; profile: UserProfile }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      if (k.startsWith(`${KEY}:`)) {
        const userId = k.replace(`${KEY}:`, "");
        const p = safeParseProfile(localStorage.getItem(k));
        if (p) out.push({ userId, profile: p });
      }
      // (old key) support
      if (k.startsWith(`${KEY}_`)) {
        const userId = k.replace(`${KEY}_`, "");
        const p = safeParseProfile(localStorage.getItem(k));
        if (p) out.push({ userId, profile: p });
      }
    }
  } catch {}

  return out;
}

/** ✅ tìm profile theo email */
export function findProfileByEmail(email: string) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;

  const list = getAllProfiles();
  for (const item of list) {
    const pEmail = String(item.profile?.email || "").trim().toLowerCase();
    if (pEmail && pEmail === e) return item;
  }
  return null;
}

/** ✅ tìm profile theo wallet */
export function findProfileByWallet(wallet: string) {
  const w = String(wallet || "").trim().toLowerCase();
  if (!w) return null;

  const list = getAllProfiles();
  for (const item of list) {
    const pWallet = String(item.profile?.walletAddress || "").trim().toLowerCase();
    if (pWallet && pWallet === w) return item;
  }
  return null;
}

/**
 * ✅ subscribeProfile(userId, cb, options?)
 * - listenAll: true => reload khi BẤT KỲ profile nào thay đổi (để hỗ trợ map authorId -> profile key khác)
 */
export function subscribeProfile(
  userId: string,
  cb: (p: UserProfile) => void,
  options: { listenAll?: boolean } = {}
) {
  if (typeof window === "undefined") return () => {};
  if (!userId) return () => {};

  const listenAll = !!options.listenAll;

  let raf = 0;
  const emit = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => cb(loadProfile(userId)));
  };

  const onLocal = (ev: Event) => {
    const anyEv = ev as any;
    const changedId = anyEv?.detail?.userId as string | undefined;

    if (listenAll) {
      emit();
      return;
    }

    if (changedId !== userId && changedId !== "*") return;
    emit();
  };

  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;

    if (listenAll) {
      if (e.key.startsWith(`${KEY}:`) || e.key.startsWith(`${KEY}_`)) emit();
      return;
    }

    if (e.key !== getKey(userId) && e.key !== `${KEY}_${userId}`) return;
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
