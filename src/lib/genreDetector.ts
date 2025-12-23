/* ================= GENRE DETECTOR ================= */

export type AutoGenre =
  | "Pop"
  | "Rock"
  | "Hip-hop"
  | "Romance"
  | "Classical"
  | "Podcast"
  | "J-Pop"
  | "Unknown";

export function detectGenre(params: {
  title: string;
  language?: string;
}): AutoGenre {
  const t = params.title.toLowerCase();

  if (t.match(/love|tình|romance/)) return "Romance";
  if (t.match(/rap|hip\s?hop/)) return "Hip-hop";
  if (t.match(/rock|metal/)) return "Rock";
  if (t.match(/classical|symphony|orchestra/))
    return "Classical";
  if (t.match(/podcast|talk|interview/))
    return "Podcast";

  if (params.language === "jp") return "J-Pop";
  if (params.language === "en") return "Pop";

  return "Unknown";
}
