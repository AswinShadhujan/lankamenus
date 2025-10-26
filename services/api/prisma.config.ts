import { defineConfig, env } from "prisma/config";
import "dotenv/config"; // <-- You need your env variables in this file for it to start working. This import worked for me in NextJS 15


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
