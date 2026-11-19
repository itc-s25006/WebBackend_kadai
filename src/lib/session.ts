import { randomBytes } from "node:crypto";
import { valkey } from "../valkey";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 日

const keyOf = (sessionId: string) => `session:${sessionId}`;

/** セッションを作って、クライアントに渡すセッション ID を返す */
export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("base64url");
  await valkey.set(keyOf(sessionId), userId, "EX", SESSION_TTL_SECONDS);
  return sessionId;
}

/** セッション ID から、ログイン中のユーザー ID を取り出す（無効なら null） */
export async function getSessionUserId(sessionId: string): Promise<string | null> {
  return await valkey.get(keyOf(sessionId));
}