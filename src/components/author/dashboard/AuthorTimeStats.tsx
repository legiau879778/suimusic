import { Work } from "@/lib/workStore";

export default function AuthorTimeStats({
  works,
}: {
  works: Work[];
}) {
  return (
    <div>
      <p>Tổng: {works.length}</p>
      <p>
        Đã duyệt:{" "}
        {works.filter(w => w.status === "verified").length}
      </p>
    </div>
  );
}
