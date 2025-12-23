import { getWorks } from "@/lib/workStore";
import { getReviewLogs } from "@/lib/reviewLogStore";

import AuthorTimeStats from "@/components/author/dashboard/AuthorTimeStats";
import AuthorActivityChart from "@/components/author/dashboard/AuthorActivityChart";
import AuthorTimeline from "@/components/author/dashboard/AuthorTimeline";

export default function AuthorDashboard({
  params,
}: {
  params: { id: string };
}) {
  const works = getWorks().filter(w => w.authorId === params.id);
  const logs = getReviewLogs().filter(
    l => works.some(w => w.id === l.workId)
  );

  return (
    <main>
      <h1>Author Dashboard</h1>
      <AuthorTimeStats works={works} />
      <AuthorActivityChart logs={logs} />
      <AuthorTimeline logs={logs} />
    </main>
  );
}
