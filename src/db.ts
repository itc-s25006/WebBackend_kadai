import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// どのドライバーで PostgreSQL に繋ぐかを指定する（Prisma 7 では必須）
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// アプリ全体で 1 つだけ作って、他のファイルから import して使い回す
export const prisma = new PrismaClient({ adapter });