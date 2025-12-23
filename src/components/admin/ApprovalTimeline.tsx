export default function ApprovalTimeline({ work }: any) {
  return (
    <ul>
      {work.reviews.map((r: any, i: number) => (
        <li key={i}>
          {r.admin} — {r.action} — {r.time}
          <br />
          <small>{r.signature}</small>
        </li>
      ))}
    </ul>
  );
}
