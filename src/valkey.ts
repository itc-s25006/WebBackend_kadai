import { RedisClient } from "bun";

// Valkey は Redis と同じ通信方式なので、Bun 標準のクライアントでそのまま繋がる
export const valkey = new RedisClient(
  process.env.VALKEY_URL ?? "redis://localhost:6379",
);