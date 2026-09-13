/**
 * Browser end-to-end tests (Playwright). Not run in CI here — requires a running stack and `npx playwright install`.
 *   npx playwright test
 * Sign-in uses the dev magic-link printed in the app log; set E2E_MAGIC_LINK_LOG=/path/to/app.log.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
const BASE = process.env.APP_URL ?? "http://localhost:3000";

test("marketing pages render", async ({ page }) => {
  await page.goto(BASE); await expect(page.getByRole("heading", { level: 1 })).toContainText("Your marketing");
  await page.goto(`${BASE}/pricing`); await expect(page.getByText("Most popular")).toBeVisible();
  await page.goto(`${BASE}/tools/ai-ugc-video-generator`); await expect(page.getByRole("heading", { level: 1 })).toContainText("AI UGC");
});

test("magic-link sign in → onboarding → blitz", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  const email = `pw-${Date.now()}@example.com`;
  await page.getByPlaceholder("you@company.com").fill(email); await page.getByRole("button", { name: /continue with email/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();
  const log = readFileSync(process.env.E2E_MAGIC_LINK_LOG ?? "/tmp/app.log", "utf8");
  const link = log.split("\n").reverse().find((l) => l.includes(`[magic-link] ${email}`))?.split("-> ")[1];
  expect(link).toBeTruthy(); await page.goto(link!);
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByPlaceholder("https://yourproduct.com").fill("https://example.com"); await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page).toHaveURL(/\/app\/blitz/, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Velocity" })).toBeVisible();
  await page.keyboard.press("ArrowRight"); // keep
  await expect(page.getByText(/1 kept this session/)).toBeVisible({ timeout: 60_000 });
});

test("free plan hits the save wall on the 4th keep", async ({ page }) => {
  // Assumes a signed-in free account with ≥4 candidates (reuse storageState from the previous test in CI)
  test.skip(!process.env.E2E_STORAGE_STATE, "needs storage state");
  await page.goto(`${BASE}/app/velocity`);
  for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(800); }
  await expect(page.getByText(/upgrade to keep going/i)).toBeVisible();
});
