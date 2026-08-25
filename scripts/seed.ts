/**
 * SEED SCRIPT - Điền dữ liệu mẫu vào Google Sheets
 * Chạy: npx ts-node scripts/seed.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runSeed } from "../lib/sheets/seed";

runSeed().catch((err) => {
  console.error("❌ Seed thất bại:", err.message);
  process.exit(1);
});
