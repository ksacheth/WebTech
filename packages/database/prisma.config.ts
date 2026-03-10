import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envFiles = [path.join(configDir, ".env"), path.join(configDir, "../../.env")];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
