import { expect, test, type Locator, type Page } from "@playwright/test";
import process from "node:process";

async function chooseTheme(page: Page, mode: "Light" | "Dark" | "System") {
  const name = new RegExp(mode, "i");
  const buttons = page.getByRole("button", { name });
  if (await buttons.count()) {
    await buttons.first().click();
    return;
  }
  await page.getByRole("radio", { name }).click();
}

async function mainBounds(main: Locator) {
  return main.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

async function themeTokens(page: Page) {
  return page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const normalized = (name: string) => {
      const value = styles.getPropertyValue(name).trim();
      return /^#[0-9a-f]{3}$/i.test(value)
        ? `#${value.slice(1).split("").map((character) => character + character).join("")}`
        : value;
    };
    return {
      background: normalized("--background"),
      surface: normalized("--background-elevated"),
      foreground: normalized("--foreground"),
      primary: normalized("--primary"),
      secondary: normalized("--secondary"),
      teal: normalized("--accent-teal"),
      coral: normalized("--accent-coral"),
    };
  });
}

test("theme choices update the root class without moving the login layout", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);

  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  const initialBounds = await mainBounds(main);

  await chooseTheme(page, "Light");
  await expect.poll(() => page.locator("html").evaluate((element) => element.classList.contains("light"))).toBe(true);
  expect(await themeTokens(page)).toEqual({
    background: "#f7f4ee",
    surface: "#ffffff",
    foreground: "#18191b",
    primary: "#c85a32",
    secondary: "#eae3d6",
    teal: "#6b7b67",
    coral: "#c85a32",
  });
  expect(await mainBounds(main)).toEqual(initialBounds);

  await chooseTheme(page, "Dark");
  await expect.poll(() => page.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  expect(await themeTokens(page)).toEqual({
    background: "#0d0e11",
    surface: "#15161b",
    foreground: "#f5f4f0",
    primary: "#de6d45",
    secondary: "#202229",
    teal: "#84967f",
    coral: "#de6d45",
  });
  expect(await mainBounds(main)).toEqual(initialBounds);

  await page.emulateMedia({ colorScheme: "dark" });
  await chooseTheme(page, "System");
  await expect.poll(() => page.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  expect(await mainBounds(main)).toEqual(initialBounds);
});

test("login page exposes accessible credential controls", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /admin vault/i })).toBeVisible();
  await expect(page.getByLabel(/username/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /enter vault/i })).toBeVisible();
});

test("configured admin credentials create a session", async ({ page }) => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!username || !password, "Requires ADMIN_USERNAME and ADMIN_PASSWORD in the local environment.");

  await page.goto("/login");
  const authResponses: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/api/auth/")) return;
    const url = new URL(response.url());
    const body = response.url().includes("/callback/credentials")
      ? (await response.text()).slice(0, 240)
      : "";
    authResponses.push(`${response.status()} ${url.origin}${url.pathname} ${body}`);
  });
  await page.getByLabel(/username/i).fill(username!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /enter vault/i }).click();

  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 }).catch(async (error) => {
    throw new Error(`${error.message}\nAuth responses: ${authResponses.join(" | ")}`);
  });
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/auth/session");
    const session = await response.json();
    return session.user?.id ?? null;
  })).toBe("admin-001");
});

test("guest event renders its passcode gate when an event is configured", async ({ page }) => {
  const eventId = process.env.E2E_GUEST_EVENT_ID;
  test.skip(
    !eventId,
    "Requires E2E_GUEST_EVENT_ID for a seeded event and a configured database."
  );

  await page.goto(`/guest/event/${eventId}`);

  await expect(page.getByText(/awaiting protocol passcode/i)).toBeVisible();
  await expect(page.getByPlaceholder(/enter_passcode/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /unlock vault/i })).toBeDisabled();
});