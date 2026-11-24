import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { zodErrors } from "../lib/validation";
import { requireLogin } from "../middleware/requireLogin";
import { topicRouter } from "./routes/topic";   // ← import に追


export const topicRouter = Router();

// topic 以下の API は、全部ログインが必要
topicRouter.use(requireLogin);

const PAGE_SIZE = 5;

// ?page=2 のような指定。変な値のときは 1 ページ目にする
const pageSchema = z.coerce.number().int().min(1).catch(1);

// GET /api/topic  トピック一覧（更新日時の新しい順、1 ページ 5 件）
topicRouter.get("/", async (req, res) => {
  const page = pageSchema.parse(req.query.page);

  const topics = await prisma.topic.findMany({
    where: { deletedAt: null }, // 削除済みは出さない
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { author: { select: { name: true, email: true } } },
  });

  // DB の項目名（camelCase）を、仕様の項目名（snake_case）に直して返す
  res.json({
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      author: t.author.name ?? t.author.email, // 名前が無ければメールアドレス
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
  });
});

// トピック作成の入力ルール（title と message は必須）
const createSchema = z.object({
  title: z
    .string({ error: "タイトルは必須項目です" })
    .trim()
    .min(1, { error: "タイトルは必須項目です" })
    .max(256, { error: "タイトルは256文字以内で入力してください" }),
  message: z
    .string({ error: "メッセージは必須項目です" })
    .trim()
    .min(1, { error: "メッセージは必須項目です" })
    .max(512, { error: "メッセージは512文字以内で入力してください" }),
});

// POST /api/topic/create  新規作成（最初の投稿も一緒に作る）
topicRouter.post("/create", async (req, res) => {
  const userId = res.locals.userId as string;

  const result = createSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ errors: zodErrors(result.error) });
  }
  const { title, message } = result.data;

  // トピックと最初の投稿を 1 回の操作で作る（片方だけ作られることはない）
  const topic = await prisma.topic.create({
    data: {
      title,
      authorId: userId,
      posts: { create: { message, contributorId: userId } },
    },
    select: { id: true, title: true },
  });

  res.status(201).json(topic);
});