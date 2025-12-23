import { ReviewLog } from "@/lib/reviewLogStore";

export default function AuthorTimeline({
  logs,
}: {
  logs: ReviewLog[];
}) {
  return (
    <ul>
      {logs.slice().reverse().map(l => (
        <li key={l.id}>
          {l.action} – {new Date(l.time).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
