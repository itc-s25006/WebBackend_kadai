import type { NextFunction, Request, Response } from "express";
import { getSessionUserId, SESSION_COOKIE } from "../lib/session";

// ログイン済みの人だけを通す関数（ミドルウェア）
export async function requireLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // 1. Cookie からセッション ID を取り出す
  const sessionId = req.cookies?.[SESSION_COOKIE];

  // 2. Valkey に聞いて、ユーザー ID を調べる
  const userId =
    typeof sessionId === "string" ? await getSessionUserId(sessionId) : null;

  // 3. 分からなければ 401 で止める
  if (!userId) {
    return res.status(401).json({
      errors: [{ name: "auth", reason: "ログインしてください" }],
    });
  }

  // 4. 後ろの処理で使えるように、ユーザー ID を預けて先へ進める
  res.locals.userId = userId;
  next();
}