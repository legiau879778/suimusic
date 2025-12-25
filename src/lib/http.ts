// src/lib/http.ts
export async function readResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}
