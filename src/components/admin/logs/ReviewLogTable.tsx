import type { ReviewLog } from "@/lib/reviewLogStore";

export default function ReviewLogTable({
  logs,
}: {
  logs: ReviewLog[];
}) {
  if (!logs || logs.length === 0) {
    return <div>Chưa có lịch sử duyệt</div>;
  }

  return (
    <table>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>{log.workTitle}</td>
            <td>{log.action}</td>
            <td>{log.adminEmail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
