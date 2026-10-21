import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const WEAK = "# Problem\nPeople find permits confusing.";
const STRONG = `# Problem statement
First-time small business owners struggle to understand which municipal permits apply to them, in which order, and which documents they need. Today they call several agencies, receive conflicting answers and submit incomplete applications, which delays opening by weeks and costs permit officers time.

# Target audience and user needs
Primary users are first-time owners opening cafés, salons or small shops who need a plain-language list of permits, the order to apply in and confidence that documents are complete. Secondary users are permit officers who need complete applications.

# Success metrics
Business goals are fewer incomplete applications and faster openings. Metrics: share of applications complete on first try (target 70 percent, baseline to be measured), checklist completion rate, and median days from first visit to submission. Each metric maps to one objective.

# Assumptions and hypotheses
Assumption: owners abandon because requirements are unclear rather than because of fees. Hypothesis: a guided questionnaire raises complete first submissions. These assumptions are not yet validated and will be tested with interviews of recent applicants.

# Scope and constraints
In scope: questionnaire, personalised checklist, document upload and tracker for the web. Out of scope: fee payment and agency back-office tools. Constraints: agencies own the legal text, WCAG 2.2 AA is required, and Arabic and English must both be supported.
`;

async function submitVersion(page: Page) {
  await page.getByRole("button", { name: "Submit for review" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Demo review", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Submit and review" }).click();
  await expect(page).toHaveURL(/\/stages\/[^/]+$/);
}

test("full journey: generate, submit, review, revise, pass, persist, switch language", async ({ page }) => {
  // 1. Open the application
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Start your first design project")).toBeVisible();

  // 2. Generate a random project
  await page.getByRole("link", { name: "Generate a project" }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Generate idea and brief" }).click();
  await expect(page.getByRole("button", { name: "Accept and start" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Sample brief from the offline generator")).toBeVisible();
  const featureCards = page.locator("h3", { hasText: "Focus features" }).locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]").locator(".rounded-md.border");
  const featureCount = await featureCards.count();
  expect(featureCount).toBeGreaterThanOrEqual(2);
  expect(featureCount).toBeLessThanOrEqual(4);

  // 3. Review and save the project brief (accept, then edit and save a new version)
  await page.getByRole("button", { name: "Accept and start" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("navigation", { name: "Project sections" })).toBeVisible();
  const projectTitle = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  expect(projectTitle.length).toBeGreaterThan(3);
  await page.getByRole("link", { name: "Brief", exact: true }).click();
  await expect(page).toHaveURL(/\/brief$/);
  await page.getByRole("button", { name: "Edit brief" }).click();
  const summary = page.getByLabel("Short description");
  await summary.fill(`${await summary.inputValue()} Focused on first-time owners.`);
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save version" }).click();
  await expect(page.getByText("Saved as brief v2.")).toBeVisible();

  // 4. Open Stage 1
  await page.getByRole("link", { name: "Workflow", exact: true }).click();
  await expect(page).toHaveURL(/\/workflow$/);
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/stages\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 2, name: "Product discovery & problem framing" })).toBeVisible();

  // 5. Submit written work and an image
  await page.getByRole("link", { name: "Start submission" }).click();
  await expect(page).toHaveURL(/\/submit$/);
  await page.getByLabel("Written work").fill(WEAK);
  const png = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#4466cc" } }).png().toBuffer();
  await page.getByTestId("file-input").setInputFiles({ name: "journey-map.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "journey-map.png" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText(/Saved \d/)).toBeVisible();

  // 6. Trigger a mock review
  await submitVersion(page);
  await expect(page.getByText("Latest feedback")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open full review" })).toBeVisible({ timeout: 30_000 });

  // 11. A failed stage cannot be marked complete
  await expect(page.getByRole("button", { name: "Complete stage" })).toBeDisabled();
  await expect(page.getByText(/latest review decision is “Revise”/)).toBeVisible();

  // 7. Score, feedback and revision tasks appear
  await page.getByRole("link", { name: "Open full review" }).click();
  await expect(page).toHaveURL(/\/reviews\/[^/]+$/);
  await expect(page.getByText("Demo review — not an AI evaluation")).toBeVisible();
  await expect(page.getByRole("img", { name: /Overall score \d+ out of 100/ })).toBeVisible();
  await expect(page.getByTestId("criterion")).toHaveCount(5);
  const tasks = page.getByTestId("revision-task");
  expect(await tasks.count()).toBeGreaterThan(0);

  // 8. Resolve a revision task
  await tasks.first().getByRole("button", { name: "Mark done" }).click();
  await expect(tasks.first().getByText("Done", { exact: true })).toBeVisible();

  // 9. Submit a second version (starting from version 1, which keeps the image)
  await page.getByRole("link", { name: "Revise and resubmit" }).click();
  await expect(page).toHaveURL(/\/submit\?from=/);
  await page.getByRole("button", { name: "Start from version 1" }).click();
  await expect(page.getByRole("img", { name: "journey-map.png" })).toBeVisible();
  await page.getByLabel("Written work").fill(STRONG);
  await expect(page.getByText(/Saved \d/)).toBeVisible();
  await submitVersion(page);
  await expect(page.getByText("Pass", { exact: true }).first()).toBeVisible({ timeout: 30_000 });

  // 10. Both review versions remain accessible
  await page.getByRole("link", { name: "Reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/reviews$/);
  const reviewRows = page.locator("main li a[href*='/reviews/']");
  await expect(reviewRows).toHaveCount(2);
  await reviewRows.last().click();
  await expect(page).toHaveURL(/\/reviews\/[^/]+$/);
  await expect(page.getByText("Earlier review")).toBeVisible();
  await page.getByRole("link", { name: "Back to stage" }).click();
  await expect(page).toHaveURL(/\/stages\/[^/]+$/);

  // 12. A passed stage becomes eligible once the required checklist is done
  await expect(page.getByText(/required checklist tasks are not done/)).toBeVisible();
  const checklist = page.getByRole("complementary", { name: "Stages and checklist" });
  const boxes = checklist.getByRole("checkbox");
  for (let i = 0; i < (await boxes.count()); i++) {
    await boxes.nth(i).check();
    await expect(boxes.nth(i)).toBeChecked();
  }
  await expect(page.getByText("Ready to complete").first()).toBeVisible();
  await page.getByRole("button", { name: "Complete stage" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "User research & synthesis" })).toBeVisible();

  // 13. Refresh and confirm persistence
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "User research & synthesis" })).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByText("1/8").first()).toBeVisible();

  // 14. Switch to Arabic and verify RTL
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("link", { name: "لوحة التحكم" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(projectTitle);
  const sidebar = page.locator("aside").first();
  const box = await sidebar.boundingBox();
  expect(box!.x).toBeGreaterThan(700); // navigation sits on the right in RTL

  // 15. Return to English; project data unchanged
  await page.getByRole("button", { name: "تغيير اللغة" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(projectTitle);
  await expect(page.getByText("1/8").first()).toBeVisible();
});

test("mobile layout uses a menu and stacked workspace panels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Settings" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
