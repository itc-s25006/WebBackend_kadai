import express from "express";
import cookieParser from "cookie-parser";
import { userRouter } from "./routes/user";
import { topicRouter } from "./routes/topic";

const app = express();

// リクエストの JSON を読み取って req.body に入れる
app.use(express.json());
// Cookie を読み取って req.cookies に入れる          // ← 追加
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// /api/user で始まる URL は userRouter に任せる
app.use("/api/user", userRouter);
app.use("/api/topic", topicRouter);

app.listen(3000, () => {
  console.log("Start server port:3000");
});