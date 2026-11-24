import type { ZodError } from "zod";

// zod のエラーを、仕様の形 [{ name, reason }] に直す
export function zodErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    name: String(issue.path[0]),
    reason: issue.message,
  }));
}