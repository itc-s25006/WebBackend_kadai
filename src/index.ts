import express from "express";
import { prisma } from "./db";

const app = express();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// DB に繋がるかの確認（起動時に 1 回だけ実行される）
const userCount = await prisma.user.count();
console.log(`User の件数: ${userCount}`);

app.listen(3000, () => {
  console.log("Start server port:3000");
});