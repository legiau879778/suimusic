import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const KEY = "chainstorm_profile";
const PROFILE_COLLECTION = "profiles";
const CACHE_TTL_MS = 30_000;

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

function normalizeEmail(v?: string) {
  return String(v || "").trim().toLowerCase();
}

function normalizeWallet(v?: string) {
  return String(v || "").trim().toLowerCase();
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
    const id = v.replace("walrus:", "");
    const clean =
      id.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(id.slice(2))
        ? id.slice(2)
        : id;
    return `/api/walrus/blob/${clean}`;
  }
  if (v.startsWith("walrus://")) {
    const id = v.replace("walrus://", "");
    const clean =
      id.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(id.slice(2))
        ? id.slice(2)
        : id;
    return `/api/walrus/blob/${clean}`;
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

function extractProfile(raw: any): UserProfile {
  if (!isPlainObject(raw)) return {};
  const out: UserProfile = {};
  const keys: Array<keyof UserProfile> = [
    "name",
    "phone",
    "cccd",
    "dob",
    "email",
    "country",
    "address",
    "walletAddress",
    "avatar",
    "socials",
    "options",
    "membership",
  ];
  keys.forEach((k) => {
    if (raw[k] !== undefined) (out as any)[k] = raw[k];
  });
  if (out.socials && !isPlainObject(out.socials)) delete (out as any).socials;
  if (out.options && !isPlainObject(out.options)) delete (out as any).options;
  return mergeProfile({}, out);
}

function loadCachedProfile(userId: string): UserProfile {
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

function saveLocalProfile(
  userId: string,
  profile: UserProfile,
  options: { notify?: boolean } = {}
) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  try {
    localStorage.setItem(getKey(userId), JSON.stringify(profile));
    if (options.notify !== false) {
      window.dispatchEvent(
        new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { userId } })
      );
    }
  } catch {}
}

const pendingFetchById = new Map<string, Promise<void>>();
const pendingFetchByEmail = new Map<string, Promise<void>>();
const pendingFetchByWallet = new Map<string, Promise<void>>();
const lastFetchById = new Map<string, number>();
const lastFetchByEmail = new Map<string, number>();
const lastFetchByWallet = new Map<string, number>();

function primeProfileById(userId: string) {
  if (typeof window === "undefined") return;
  const id = String(userId || "").trim();
  if (!id) return;
  if (!db) return;

  const last = lastFetchById.get(id) || 0;
  if (Date.now() - last < CACHE_TTL_MS) return;
  if (pendingFetchById.has(id)) return;

  lastFetchById.set(id, Date.now());
  const p = getDoc(doc(db, PROFILE_COLLECTION, id))
    .then((snap) => {
      if (!snap.exists()) {
        const cached = loadCachedProfile(id);
        if (!Object.keys(cached).length) return;
        const payload = {
          ...cached,
          userId: id,
          emailLower: normalizeEmail(cached.email),
          walletLower: normalizeWallet(cached.walletAddress),
          updatedAt: serverTimestamp(),
        };
        void setDoc(doc(db, PROFILE_COLLECTION, id), payload, { merge: true });
        return;
      }
      const profile = extractProfile(snap.data());
      if (!Object.keys(profile).length) return;
      const merged = mergeProfile(loadCachedProfile(id), profile);
      saveLocalProfile(id, merged, { notify: true });
    })
    .catch(() => {})
    .finally(() => {
      pendingFetchById.delete(id);
    });

  pendingFetchById.set(id, p);
}

function primeProfileByEmail(email?: string) {
  if (typeof window === "undefined") return;
  const e = normalizeEmail(email);
  if (!e) return;
  if (!db) return;

  const last = lastFetchByEmail.get(e) || 0;
  if (Date.now() - last < CACHE_TTL_MS) return;
  if (pendingFetchByEmail.has(e)) return;

  lastFetchByEmail.set(e, Date.now());
  const p = getDocs(
    query(collection(db, PROFILE_COLLECTION), where("emailLower", "==", e))
  )
    .then((snap) => {
      snap.forEach((docSnap) => {
        const profile = extractProfile(docSnap.data());
        if (!Object.keys(profile).length) return;
        const merged = mergeProfile(loadCachedProfile(docSnap.id), profile);
        saveLocalProfile(docSnap.id, merged, { notify: true });
      });
    })
    .catch(() => {})
    .finally(() => {
      pendingFetchByEmail.delete(e);
    });

  pendingFetchByEmail.set(e, p);
}

function primeProfileByWallet(wallet?: string) {
  if (typeof window === "undefined") return;
  const w = normalizeWallet(wallet);
  if (!w) return;
  if (!db) return;

  const last = lastFetchByWallet.get(w) || 0;
  if (Date.now() - last < CACHE_TTL_MS) return;
  if (pendingFetchByWallet.has(w)) return;

  lastFetchByWallet.set(w, Date.now());
  const p = getDocs(
    query(collection(db, PROFILE_COLLECTION), where("walletLower", "==", w))
  )
    .then((snap) => {
      snap.forEach((docSnap) => {
        const profile = extractProfile(docSnap.data());
        if (!Object.keys(profile).length) return;
        const merged = mergeProfile(loadCachedProfile(docSnap.id), profile);
        saveLocalProfile(docSnap.id, merged, { notify: true });
      });
    })
    .catch(() => {})
    .finally(() => {
      pendingFetchByWallet.delete(w);
    });

  pendingFetchByWallet.set(w, p);
}

/**
 * ✅ loadProfile(userId)
 * - dùng cache localStorage để sync UI
 * - nền: refresh từ Firestore
 */
export function loadProfile(userId: string): UserProfile {
  const cached = loadCachedProfile(userId);
  primeProfileById(userId);
  return cached;
}

/**
 * ✅ saveProfile(userId, data, options?)
 * - cập nhật cache localStorage
 * - ghi Firestore (source of truth)
 */
export function saveProfile(
  userId: string,
  data: UserProfile,
  options: { replace?: boolean } = {}
) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  try {
    const current = options.replace ? ({} as UserProfile) : loadCachedProfile(userId);
    const merged = mergeProfile(current, data);
    saveLocalProfile(userId, merged, { notify: true });

    const payload = {
      ...merged,
      userId,
      emailLower: normalizeEmail(merged.email),
      walletLower: normalizeWallet(merged.walletAddress),
      updatedAt: serverTimestamp(),
    };
    void setDoc(doc(db, PROFILE_COLLECTION, userId), payload, {
      merge: !options.replace,
    });
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
 * - xoá hết key profile cache localStorage
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

/** ✅ lấy tất cả profiles trong localStorage cache */
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

/** ✅ tìm profile theo email (cache trước, Firestore sau) */
export function findProfileByEmail(email?: string) {
  const e = normalizeEmail(email);
  if (!e) return null;

  const list = getAllProfiles();
  for (const item of list) {
    const pEmail = normalizeEmail(item.profile?.email);
    if (pEmail && pEmail === e) return item;
  }

  primeProfileByEmail(e);
  return null;
}

/** ✅ tìm profile theo wallet (cache trước, Firestore sau) */
export function findProfileByWallet(wallet?: string) {
  const w = normalizeWallet(wallet);
  if (!w) return null;

  const list = getAllProfiles();
  for (const item of list) {
    const pWallet = normalizeWallet(item.profile?.walletAddress);
    if (pWallet && pWallet === w) return item;
  }

  primeProfileByWallet(w);
  return null;
}

/**
 * ✅ subscribeProfile(userId, cb, options?)
 * - nghe PROFILE_UPDATED_EVENT (same tab)
 * - nghe storage event (other tabs)
 * - nghe Firestore doc + query (email/wallet) để sync đa thiết bị
 */
export function subscribeProfile(
  userId: string,
  cb: (p: UserProfile) => void,
  options?: { listenAll?: boolean; email?: string; wallet?: string }
) {
  if (typeof window === "undefined") return () => {};
  if (!userId) return () => {};

  const listenAll = !!options?.listenAll;
  const email = normalizeEmail(options?.email);
  const wallet = normalizeWallet(options?.wallet);

  let raf = 0;
  const emit = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => cb(loadProfile(userId)));
  };

  emit();

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

    const newKey = getKey(userId);
    const oldKey = getOldKey(userId);
    if (e.key === newKey || e.key === oldKey) emit();
  };

  window.addEventListener(PROFILE_UPDATED_EVENT, onLocal as any);
  window.addEventListener("storage", onStorage);

  const unsubscribers: Array<() => void> = [];

  try {
    const ref = doc(db, PROFILE_COLLECTION, userId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const profile = extractProfile(snap.data());
      if (!Object.keys(profile).length) return;
      const merged = mergeProfile(loadCachedProfile(userId), profile);
      saveLocalProfile(userId, merged, { notify: true });
      emit();
    });
    unsubscribers.push(unsub);
  } catch {}

  if (listenAll && email) {
    try {
      const q = query(
        collection(db, PROFILE_COLLECTION),
        where("emailLower", "==", email)
      );
      const unsub = onSnapshot(q, (snap) => {
        let touched = false;
        snap.forEach((docSnap) => {
          const profile = extractProfile(docSnap.data());
          if (!Object.keys(profile).length) return;
          const merged = mergeProfile(loadCachedProfile(docSnap.id), profile);
          saveLocalProfile(docSnap.id, merged, { notify: true });
          touched = true;
        });
        if (touched) emit();
      });
      unsubscribers.push(unsub);
    } catch {}
  }

  if (listenAll && wallet) {
    try {
      const q = query(
        collection(db, PROFILE_COLLECTION),
        where("walletLower", "==", wallet)
      );
      const unsub = onSnapshot(q, (snap) => {
        let touched = false;
        snap.forEach((docSnap) => {
          const profile = extractProfile(docSnap.data());
          if (!Object.keys(profile).length) return;
          const merged = mergeProfile(loadCachedProfile(docSnap.id), profile);
          saveLocalProfile(docSnap.id, merged, { notify: true });
          touched = true;
        });
        if (touched) emit();
      });
      unsubscribers.push(unsub);
    } catch {}
  }

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener(PROFILE_UPDATED_EVENT, onLocal as any);
    window.removeEventListener("storage", onStorage);
    unsubscribers.forEach((fn) => fn());
  };
}
