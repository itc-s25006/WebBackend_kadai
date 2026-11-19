import express from "express";
import { userRouter } from "./routes/user";

const app = express();

// リクエストの JSON を読み取って req.body に入れる
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// /api/user で始まる URL は userRouter に任せる
app.use("/api/user", userRouter);

app.listen(3000, () => {
  console.log("Start server port:3000");
});