import { expect, type Page, test } from "@playwright/test";

const protectedRoutes = ["/user", "/ai", "/admin", "/admin/sync"];

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.exposeFunction("__a526ConsoleErrors", () => errors);
});

test("renders login and register without leaking session material", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("textbox")).toBeVisible();
  await expect(page.getByRole("button", { name: /发送验证码/ })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/lap_session|otp|tokenHash|DATABASE_URL/i);

  await page.goto("/auth/register");
  await expect(page.locator("body")).toContainText(/注册|登录|邮箱/);
  await assertNoConsoleErrors(page);
  await assertNoHorizontalOverflow(page);
});

test("protects authenticated routes when no database session exists", async ({ page }) => {
  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/auth/login\\?returnTo=${encodeURIComponent(route)}`));
  }
  await assertNoConsoleErrors(page);
});

test("renders public learning surfaces and 404 page", async ({ page }) => {
  await page.goto("/articles");
  await expect(page.locator("body")).toContainText(/文章|热点|GitHub/);
  await assertNoHorizontalOverflow(page);

  await page.goto("/problems");
  await expect(page.locator("body")).toContainText(/Codeforces|题目|训练/);
  await assertNoHorizontalOverflow(page);
  await assertNoConsoleErrors(page);

  const notFoundResponse = await page.goto("/a526-not-found");
  expect(notFoundResponse?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/404|This page could not be found|找不到/);
});

test("mobile navigation control is visible on narrow viewport", async ({ page, isMobile }) => {
  await page.goto("/auth/login");
  if (isMobile) {
    await expect(page.getByRole("button", { name: "打开导航菜单" })).toBeVisible();
  }
  await assertNoHorizontalOverflow(page);
  await assertNoConsoleErrors(page);
});

async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBe(false);
}

async function assertNoConsoleErrors(page: Page) {
  const errors = await page.evaluate(async () => {
    const getter = (window as unknown as { __a526ConsoleErrors: () => string[] }).__a526ConsoleErrors;
    return getter();
  });
  expect(errors).toEqual([]);
}
