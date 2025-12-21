/**
 * Centralized blurDataURL presets
 * Use for Next.js <Image placeholder="blur" />
 */

export const BLUR_HERO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 30'>
      <defs>
        <linearGradient id='g'>
          <stop stop-color='#020617' offset='20%'/>
          <stop stop-color='#1e293b' offset='70%'/>
        </linearGradient>
      </defs>
      <rect width='40' height='30' fill='url(#g)'/>
    </svg>`
  ).toString("base64");

export const BLUR_THUMB =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 15'>
      <rect width='20' height='15' fill='#1e293b'/>
    </svg>`
  ).toString("base64");

export const BLUR_AVATAR =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'>
      <circle cx='5' cy='5' r='5' fill='#334155'/>
    </svg>`
  ).toString("base64");
