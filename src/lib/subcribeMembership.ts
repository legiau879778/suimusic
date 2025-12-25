// src/lib/subcribeMembership.ts
export const MEMBERSHIP_UPDATED_EVENT = "chainstorm_membership_updated";

export function subscribeMembership(cb: () => void) {
  if (typeof window === "undefined") return () => {};

  const handler = () => cb();

  window.addEventListener(MEMBERSHIP_UPDATED_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(MEMBERSHIP_UPDATED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
