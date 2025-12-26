import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/admin/sidebar.module.css";

export default function AdminSidebar() {
  const pathname = usePathname();

  const nav = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/review", label: "Review works" },
    { href: "/admin/logs", label: "Review history" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/stats", label: "Statistics" },
  ];

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.menu}>
        {nav.map(i => (
          <Link
            key={i.href}
            href={i.href}
            className={`${styles.menuLink} ${
              pathname === i.href ? styles.active : ""
            }`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
