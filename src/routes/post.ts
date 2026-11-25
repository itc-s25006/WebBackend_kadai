import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { forbiddenBody, notFoundBody } from "../lib/errors";
import { zodErrors } from "../lib/validation";
import { requireLogin } from "../middleware/requireLogin";
import { postSchema } from "./topic";

export const postRouter = Router();

// post 以下の API は、全部ログインが必要
postRouter.use(requireLogin);

const postIdSchema = z.uuid();

// メッセージが「見える状態」で存在するかを調べる
// （削除済みのメッセージや、削除済みトピックの中のメッセージは「無い」扱い）
function findVisiblePost(postId: string) {
  return prisma.post.findFirst({
    where: { id: postId, deletedAt: null, topic: { deletedAt: null } },
    select: { contributorId: true },
  });
}

// PUT /api/post/:post_id  メッセージ変更（投稿者だけ）
postRouter.put("/:post_id", async (req, res) => {
  const userId = res.locals.userId as string;

  const idResult = postIdSchema.safeParse(req.params.post_id);
  if (!idResult.success) {
    return res.status(404).json(notFoundBody);
  }

  const result = postSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ errors: zodErrors(result.error) });
  }

  const post = await findVisiblePost(idResult.data);
  if (!post) {
    return res.status(404).json(notFoundBody);
  }
  if (post.contributorId !== userId) {
    return res.status(403).json(forbiddenBody);
  }

  // トピックの updatedAt は触らない（編集では一覧の上に上げない）
  await prisma.post.update({
    where: { id: idResult.data },
    data: { message: result.data.message },
  });

  res.json({ message: "OK" });
});

// DELETE /api/post/:post_id  メッセージ削除（投稿者だけ。論理削除）
postRouter.delete("/:post_id", async (req, res) => {
  const userId = res.locals.userId as string;

  const idResult = postIdSchema.safeParse(req.params.post_id);
  if (!idResult.success) {
    return res.status(404).json(notFoundBody);
  }

  const post = await findVisiblePost(idResult.data);
  if (!post) {
    return res.status(404).json(notFoundBody);
  }
  if (post.contributorId !== userId) {
    return res.status(403).json(forbiddenBody);
  }

  await prisma.post.update({
    where: { id: idResult.data },
    data: { deletedAt: new Date() },
  });

  res.json({ message: "deleted" });
});