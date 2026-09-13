import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", timeout: 180_000, use: { baseURL: process.env.APP_URL ?? "http://localhost:3000", headless: true }, reporter: "list" });
