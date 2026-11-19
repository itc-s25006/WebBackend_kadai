import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../lib/session";
import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db";
import { Prisma } from "../../generated/prisma/client";

export const userRouter = Router();

// 入力のルール（仕様: email と password は必須、password は 8 文字以上、name は任意）
const registerSchema = z.object({
  email: z
    .email({ error: "メールアドレス形式で入力してください" })
    .max(256, { error: "メールアドレスが長すぎます" })
    .toLowerCase(),
  password: z
    .string({ error: "パスワードは必須です" })
    .min(8, { error: "パスワードが短すぎます" }),
  name: z
    .string({ error: "名前は文字列で入力してください" })
    .max(128, { error: "名前が長すぎます" })
    .optional(),
});

// POST /api/user/register
userRouter.post("/register", async (req, res) => {
  // 1. 入力チェック
  const result = registerSchema.safeParse(req.body ?? {});
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      name: String(issue.path[0]),
      reason: issue.message,
    }));
    return res.status(400).json({ errors });
  }
  const { email, password, name } = result.data;

  // 2. パスワードをハッシュ化（元に戻せない形にする）
  const hash = await argon2.hash(password);

  // 3. DB に保存
  try {
    await prisma.user.create({ data: { email, password: hash, name } });
  } catch (e) {
    // email は UNIQUE なので、登録済みなら P2002 エラーになる
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(400).json({
        errors: [{ name: "email", reason: "このメールアドレスは既に登録されています" }],
      });
    }
    throw e;
  }

  res.json({ message: "OK" });
});

// ログインの入力ルール
const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// 失敗の理由は「どちらが違うか」を教えない（メールの存在を知られないため）
const loginFailed = {
  errors: [{ name: "auth", reason: "ログインに失敗しました" }],
};

// POST /api/user/login
userRouter.post("/login", async (req, res) => {
  const result = loginSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(401).json(loginFailed);
  }
  const email = result.data.email.toLowerCase();

  // 1. ユーザーを探す（削除済みのユーザーは除く）
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (!user) {
    return res.status(401).json(loginFailed);
  }

  // 2. パスワードを照合する
  const ok = await argon2.verify(user.password, result.data.password);
  if (!ok) {
    return res.status(401).json(loginFailed);
  }

  // 3. セッションを作って、Cookie で渡す
  const sessionId = await createSession(user.id);
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true, // JavaScript から読めなくする
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
  res.json({ message: "OK" });
});