import { expect, test, type Locator, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

const publicPaths = ["", "/regulation", "/timeline", "/tracks", "/criteria", "/prizes", "/faq", "/contacts", "/login", "/register", "/reset-password"];

async function login(page: Page, studentId: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.locator('input[name="studentId"]').fill(studentId);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

function tashkent(offsetMs: number) {
  return new Date(Date.now() + offsetMs + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

async function saveStage(form: Locator, status: string, opens: string, update: string, deadline: string) {
  await form.locator('input[name="opensAt"]').fill(opens);
  await form.locator('input[name="updateDeadlineAt"]').fill(update);
  await form.locator('input[name="deadlineAt"]').fill(deadline);
  await form.locator('select[name="status"]').selectOption(status);
  await form.locator('input[name="confirm"]').check();
  await form.getByRole("button", { name: "Change status" }).click();
  await expect(form.getByText("opening must be before")).toHaveCount(0);
}

test.beforeAll(() => {
  execSync("npx tsx e2e/reset-demo.ts", { stdio: "inherit" });
});

test.afterAll(() => {
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
});

test("anonymous pages, languages, and role redirects", async ({ page }) => {
  for (const locale of ["uz", "ru", "en"]) {
    await page.goto(`/${locale}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  }
  for (const path of publicPaths) {
    const response = await page.goto(`/en${path}`);
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.goto("/en/forgot-password");
  await expect(page).toHaveURL(/\/en\/login/);
  for (const path of ["/cabinet", "/judge", "/admin"]) {
    await page.goto(`/en${path}`);
    await expect(page).toHaveURL(new RegExp(`/en/login\\?next=%2Fen%2F${path.slice(1)}$`));
  }
});

test("register, create a team, and open the team dashboard", async ({ page }) => {
  const studentId = `E2E${Date.now()}`;
  await page.context().clearCookies();
  await page.goto("/en/register");
  await page.locator("#fullName").fill("Play Leader");
  await page.locator("#studentId").fill(studentId);
  await page.locator("#groupName").fill("IT-25-09");
  await page.locator("#phone").fill("+998901110099");
  await page.locator("#password").fill("Team-pass-1");
  await page.locator("#acceptRules").check();
  await page.getByRole("button", { name: "Create the team" }).click();
  await expect(page).toHaveURL(/\/en\/cabinet$/);
  await expect(page.getByRole("heading", { name: "Your cabinet" })).toBeVisible();
});

test("participant, judge, and admin stay inside their roles", async ({ page }) => {
  await login(page, "MU-24001", "Team-pass-1");
  await expect(page).toHaveURL(/\/en\/cabinet/);
  for (const path of ["/cabinet/team", "/cabinet/stage-1", "/cabinet/stage-2", "/cabinet/results", "/cabinet/notifications"]) {
    await page.goto(`/en${path}`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/?$/);
  await page.goto("/en/judge");
  await expect(page).toHaveURL(/\/en\/?$/);

  await login(page, "MU-JUDGE-1", "Judge-pass-1");
  await expect(page).toHaveURL(/\/en\/judge/);
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/?$/);
  await page.goto("/en/cabinet");
  await expect(page).toHaveURL(/\/en\/?$/);

  await login(page, "MU-ADMIN", "Admin-pass-1");
  await expect(page).toHaveURL(/\/en\/admin/);
  for (const path of ["/admin/stages", "/admin/users", "/admin/roster", "/admin/submissions", "/admin/assignments", "/admin/ranking", "/admin/content", "/admin/audit", "/admin/settings"]) {
    await page.goto(`/en${path}`);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("deadline lock, one update, scoring, and publishing", async ({ page }) => {
  test.setTimeout(240000);
  await login(page, "MU-ADMIN", "Admin-pass-1");
  await page.goto("/en/admin/stages");
  const stage = page.locator("form").filter({ has: page.getByRole("heading", { name: "Stage 1" }) }).first();
  await saveStage(stage, "OPEN", tashkent(-2 * 86400000), tashkent(-2 * 3600000), tashkent(-3600000));

  await login(page, "MU-24001", "Team-pass-1");
  await page.goto("/en/cabinet/stage-1");
  await expect(page.getByText("Writing is closed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit application" })).toHaveCount(0);

  await login(page, "MU-ADMIN", "Admin-pass-1");
  await page.goto("/en/admin/stages");
  const open = page.locator("form").filter({ has: page.getByRole("heading", { name: "Stage 1" }) }).first();
  await saveStage(open, "OPEN", tashkent(-86400000), tashkent(5 * 86400000), tashkent(6 * 86400000));

  await login(page, "MU-24001", "Team-pass-1");
  await page.goto("/en/cabinet/stage-1");
  const text = "Students lose time because the information is scattered across several places.";
  await page.locator("#title").fill("Atlas timetable");
  await page.locator("#shortDescription").fill(text);
  await page.locator("#problem").fill(text);
  await page.locator("#audience").fill(text);
  await page.locator("#solution").fill(text);
  await page.locator("#differentiation").fill(text);
  await page.locator("#validation").fill(text);
  await page.locator("#teamRoles").fill("Aziza leads product. Sardor builds the interface.");
  await page.getByRole("checkbox", { name: /agrees to the regulation/ }).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByRole("button", { name: "Use the one update" })).toBeVisible();
  await page.locator("#title").fill("Atlas timetable updated");
  await page.getByRole("button", { name: "Use the one update" }).click();
  await expect(page.getByText("Update used")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use the one update" })).toHaveCount(0);

  await login(page, "MU-ADMIN", "Admin-pass-1");
  await page.goto("/en/admin/stages");
  const evaluating = page.locator("form").filter({ has: page.getByRole("heading", { name: "Stage 1" }) }).first();
  await saveStage(evaluating, "EVALUATING", tashkent(-86400000), tashkent(5 * 86400000), tashkent(6 * 86400000));
  await page.goto("/en/admin/assignments");
  await page.getByRole("button", { name: "Auto-assign" }).click();

  let assigned = 0;
  for (const judge of ["MU-JUDGE-1", "MU-JUDGE-2", "MU-JUDGE-3"]) {
    await login(page, judge, "Judge-pass-1");
    await page.goto("/en/judge");
    const jobs = await page.locator("tr").filter({ hasText: "Assigned to me" }).evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const href = node.querySelector("a")?.getAttribute("href") ?? "";
        return href ? [{ href, fullMarks: (node.textContent ?? "").toLowerCase().includes("atlas") }] : [];
      }),
    );
    assigned += jobs.length;
    for (const job of jobs) {
      const { href, fullMarks } = job;
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20000 });
      const numbers = page.locator('input[type="number"]');
      const count = await numbers.count();
      for (let scoreIndex = 0; scoreIndex < count; scoreIndex += 1) {
        const max = await numbers.nth(scoreIndex).getAttribute("max");
        await numbers.nth(scoreIndex).fill(fullMarks ? (max ?? "0") : "1");
      }
      await page.getByRole("checkbox", { name: /only an admin can reopen/ }).check();
      await page.getByRole("button", { name: "Finalize review" }).click();
      await expect(page.getByRole("button", { name: "Finalize review" })).toHaveCount(0);
    }
  }
  expect(assigned).toBeGreaterThan(0);

  await login(page, "MU-ADMIN", "Admin-pass-1");
  await page.goto("/en/admin/ranking?stage=STAGE1");
  const compute = page.locator("form").filter({ has: page.getByRole("button", { name: "Compute ranking" }) });
  await compute.getByRole("button", { name: "Compute ranking" }).click();
  await expect(compute.getByText("Saved")).toBeVisible();
  await expect(page.getByText("Atlas timetable updated")).toBeVisible();
  const select = page.locator("form").filter({ has: page.getByRole("button", { name: "Select advancing teams" }) });
  await select.getByRole("checkbox", { name: "I understand this cannot be undone from the page." }).check();
  await select.getByRole("button", { name: "Select advancing teams" }).click();
  await expect(select.getByText("Saved")).toBeVisible();
  const publish = page.locator("form").filter({ has: page.getByRole("button", { name: "Publish results" }) });
  await publish.getByRole("checkbox", { name: /Publishing shows averaged scores/ }).check();
  await publish.getByRole("button", { name: "Publish results" }).click();
  await expect(publish.getByText("Saved")).toBeVisible();

  await login(page, "MU-24001", "Team-pass-1");
  await page.goto("/en/cabinet/results");
  await expect(page.getByText("100 / 100")).toBeVisible();
  await expect(page.getByText("Advanced", { exact: true })).toBeVisible();
  await page.goto("/en/cabinet/stage-2");
  await expect(page.getByText("Writing is closed.")).toBeVisible();
  await expect(page.getByText("only if this team is selected")).toHaveCount(0);
});
