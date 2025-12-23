"use client";

import { useParams } from "next/navigation";
import styles from "./author.module.css";

import { getAuthorById } from "@/lib/authorStore";
import {
  getWorks,
  countWorksByAuthor,
  Work,
} from "@/lib/workStore";

import AuthorHeader from "@/app/author/[id]/AuthorHeader";
import AuthorStats from "@/app/author/[id]/AuthorStats";
import AuthorWorks from "@/app/author/[id]/AuthorWorks";

export default function AuthorPage() {
  const params = useParams();
  const authorId = params.id as string;

  const author = getAuthorById(authorId);
  const works = getWorks().filter(
    (w) => w.authorId === authorId
  );

  if (!author) {
    return <div>Không tìm thấy tác giả</div>;
  }

  return (
    <main className={styles.page}>
      <AuthorHeader author={author} />
      <AuthorStats
        totalWorks={countWorksByAuthor(authorId)}
        verifiedWorks={
          works.filter(w => w.status === "verified").length
        }
        pendingWorks={
          works.filter(w => w.status === "pending").length
        }
      />
      <AuthorWorks works={works} />
    </main>
  );
}
