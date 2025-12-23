import React from "react";

/* =========================
   ARTIST
========================= */
export function ArtistIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="64"
      height="64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 19v3" />
    </svg>
  );
}

/* =========================
   CREATOR
========================= */
export function CreatorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="64"
      height="64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M3 18a3 3 0 0 0 6 0" />
      <path d="M21 18a3 3 0 0 1-6 0" />
    </svg>
  );
}

/* =========================
   BUSINESS
========================= */
export function BusinessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="64"
      height="64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

/* =========================
   AI / PLATFORM
========================= */
export function AiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="64"
      height="64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 1v4M15 1v4M9 19v4M15 19v4" />
      <path d="M1 9h4M1 15h4M19 9h4M19 15h4" />
    </svg>
  );
}
