export type User = {
  id: string;
  name: string;
  role: "user" | "author" | "admin";
  email: string;
};
