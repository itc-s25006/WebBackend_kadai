import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { zodErrors } from "../lib/validation";
import { requireLogin } from "../middleware/requireLogin";
import { topicRouter } from "./routes/topic";   // ← import に追
import { Prisma } from "../../generated/prisma/client";
import { notFoundBody } from "../lib/errors";
import { forbiddenBody, notFoundBody } from "../lib/errors";

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

// ---- ここから下は、トピックの中のメッセージ関連 ----
// 注意: "/create" のルートは必ずこれらより上に書くこと。
// 下の "/:topic_id" は "create" という文字列も topic_id として受け取ってしまうため。

const MESSAGES_PER_PAGE = 10;

// topic_id が UUID の形でなければ、DB に聞くまでもなく「存在しない」
const topicIdSchema = z.uuid();

// GET /api/topic/:topic_id  メッセージ一覧（古い順、1 ページ 10 件）
topicRouter.get("/:topic_id", async (req, res) => {
  const idResult = topicIdSchema.safeParse(req.params.topic_id);
  if (!idResult.success) {
    return res.status(404).json(notFoundBody);
  }
  const page = pageSchema.parse(req.query.page);

  const topic = await prisma.topic.findFirst({
    where: { id: idResult.data, deletedAt: null },
    include: {
      posts: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * MESSAGES_PER_PAGE,
        take: MESSAGES_PER_PAGE,
        include: { contributor: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!topic) {
    return res.status(404).json(notFoundBody);
  }

  res.json({
    id: topic.id,
    title: topic.title,
    last_update: topic.updatedAt,
    posts: topic.posts.map((p) => ({
      id: p.id,
      contributor: {
        id: p.contributor.id,
        name: p.contributor.name ?? p.contributor.email,
      },
      message: p.message,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
  });
});

// メッセージ投稿の入力ルール
const postSchema = z.object({
  message: z
    .string({ error: "メッセージは必須項目です" })
    .trim()
    .min(1, { error: "メッセージは必須項目です" })
    .max(512, { error: "メッセージは512文字以内で入力してください" }),
});

// POST /api/topic/:topic_id  メッセージ投稿（トピックを一覧の上に上げる）
topicRouter.post("/:topic_id", async (req, res) => {
  const userId = res.locals.userId as string;

  const idResult = topicIdSchema.safeParse(req.params.topic_id);
  if (!idResult.success) {
    return res.status(404).json(notFoundBody);
  }

  const result = postSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ errors: zodErrors(result.error) });
  }

  try {
    // 投稿の追加と、トピックの更新日時の更新を 1 回の操作で行う
    await prisma.topic.update({
      where: { id: idResult.data, deletedAt: null },
      data: {
        updatedAt: new Date(),
        posts: { create: { message: result.data.message, contributorId: userId } },
      },
    });
  } catch (e) {
    // 対象のトピックが無い（または削除済み）と P2025 になる
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return res.status(404).json(notFoundBody);
    }
    throw e;
  }

  res.json({ message: "OK" });
});

// PUT /api/topic/:topic_id  タイトル変更（作成者だけ）
topicRouter.put("/:topic_id", async (req, res) => {
  const userId = res.locals.userId as string;

  const idResult = topicIdSchema.safeParse(req.params.topic_id);
  if (!idResult.success) {
    return res.status(404).json(notFoundBody);
  }

  // 作成のときのタイトルのルールを、そのまま使い回す
  const result = createSchema.pick({ title: true }).safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ errors: zodErrors(result.error) });
  }

  // 1. 存在するか（無い・削除済みなら 404）
  const topic = await prisma.topic.findFirst({
    where: { id: idResult.data, deletedAt: null },
    select: { authorId: true },
  });
  if (!topic) {
    return res.status(404).json(notFoundBody);
  }

  // 2. 作成者本人か（違えば 403）
  if (topic.authorId !== userId) {
    return res.status(403).json(forbiddenBody);
  }

  await prisma.topic.update({
    where: { id: idResult.data },
    data: { title: result.data.title },
  });

  res.json({ message: "OK" });
});

// DELETE /api/topic/:topic_id  トピック削除（作成者だけ。論理削除）
topicRouter.delete("/:topic_id", async (req, res) => {
  const userId = res.locals.userId as string;

  const idResult = topicIdSchema.safeParse(req.params.topic_id);
  if (!idResult.success) {
    return res.status(404).json(notFoundBody);
  }

  const topic = await prisma.topic.findFirst({
    where: { id: idResult.data, deletedAt: null },
    select: { authorId: true },
  });
  if (!topic) {
    return res.status(404).json(notFoundBody);
  }
  if (topic.authorId !== userId) {
    return res.status(403).json(forbiddenBody);
  }

  // 行は消さずに、削除した日時を入れるだけ（論理削除）
  await prisma.topic.update({
    where: { id: idResult.data },
    data: { deletedAt: new Date() },
  });

  res.json({ message: "deleted" });
});