const KEY = "chainstorm_account_status";

export function requestDelete(userId: string) {
  const data = {
    status: "pending_delete",
    at: Date.now(),
  };
  localStorage.setItem(`${KEY}_${userId}`, JSON.stringify(data));
}

export function cancelDelete(userId: string) {
  localStorage.removeItem(`${KEY}_${userId}`);
}

export function getDeleteStatus(userId: string) {
  const raw = localStorage.getItem(`${KEY}_${userId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function isExpired(at: number) {
  return Date.now() - at > 24 * 60 * 60 * 1000;
}
