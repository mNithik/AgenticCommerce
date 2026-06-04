import { test, expect } from "@playwright/test";

test("loads the dashboard shell", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Receipt-backed research/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Diligence question")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^Run diligence$/,
    }).first(),
  ).toBeVisible();
});

test("opens the API integrations section", async ({ page }) => {
  await page.goto("/");
  const integrationsHeading = page.getByText("ProofSpend for other agents", {
    exact: true,
  });
  await integrationsHeading.scrollIntoViewIfNeeded();
  await expect(integrationsHeading).toBeVisible();
  await expect(page.getByText("POST /api/mcp")).toBeVisible();
});
