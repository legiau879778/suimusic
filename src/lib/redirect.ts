const KEY = "redirect_after_login";

export function saveRedirect(path?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, path || window.location.pathname);
}

export function consumeRedirect(): string {
  if (typeof window === "undefined") return "/";
  const p = localStorage.getItem(KEY) || "/";
  localStorage.removeItem(KEY);
  return p;
}
