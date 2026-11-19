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