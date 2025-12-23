const KEY = "chainstorm_profile";

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

  /** WALLET */
  walletAddress?: string;

  socials?: SocialLinks;
  options?: ProfileOptions;
};

export function loadProfile(userId: string): UserProfile {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(
      localStorage.getItem(`${KEY}_${userId}`) || "{}"
    );
  } catch {
    return {};
  }
}

export function saveProfile(userId: string, data: UserProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `${KEY}_${userId}`,
    JSON.stringify(data)
  );
}
