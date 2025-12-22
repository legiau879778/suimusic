export type User = {
  id: string;
  name: string;
  role: "user" | "author" | "admin" | "super_admin";
  email: string;
};

export type UserRole = "user" | "author" | "admin" | "super_admin"