import { getAuthors } from "./authorStore";
import { getWorks } from "./workStore";

export function getAdminStats() {
  const authors = getAuthors();
  const works = getWorks();

  return {
    authors: {
      total: authors.length,
      pending: authors.filter(a => a.status === "pending").length,
      approved: authors.filter(a => a.status === "approved").length,
      rejected: authors.filter(a => a.status === "rejected").length,
    },
    works: {
      total: works.length,
      pending: works.filter(w => w.status === "pending").length,
      verified: works.filter(w => w.status === "verified").length,
      traded: works.filter(w => w.status === "traded").length,
    },
  };
}
