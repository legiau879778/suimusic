export type User = {
  id: string;
  wallet?: string;
  role: "user" | "author" | "admin" | "super_admin";
  email: string;
  createAt: number;
};

export type UserRole = "user" | "author" | "admin" | "super_admin"