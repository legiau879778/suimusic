export default function StatusBadge({
  status,
}: {
  status: "pending" | "verified" | "rejected";
}) {
  return (
    <span className={`badge ${status}`}>
      {status === "pending" && "⏳ Pending"}
      {status === "verified" && "✔ Verified"}
      {status === "rejected" && "✖ Rejected"}
    </span>
  );
}
