import { ReviewLog } from "@/lib/reviewLogStore";

export default function AuthorActivityChart({
  logs,
}: {
  logs: ReviewLog[];
}) {
  const byDay: Record<string, number> = {};

  logs.forEach(l => {
    const d = new Date(l.time).toLocaleDateString();
    byDay[d] = (byDay[d] || 0) + 1;
  });

  return (
    <div>
      <h3>Hoạt động theo ngày</h3>
      {Object.entries(byDay).map(([d, c]) => (
        <div key={d}>{d}: {c}</div>
      ))}
    </div>
  );
}
