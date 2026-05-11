// ─────────────────────────────────────────────────────────────────────────────
// tests/configurator.spec.ts — Camille by Buyticle
// Playwright E2E: full configurator journey — form fill, prompt preview,
// mobile responsiveness check.
// Run: npm run test:e2e
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect, type Page } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillStep1(page: Page) {
  await page.fill('[name="business_name"]',   "La Belle Époque");
  await page.fill('[name="owner_name"]',      "Marie Dupont");
  await page.fill('[name="owner_email"]',     "marie@labelleepoque.fr");
  await page.fill('[name="whatsapp_number"]', "+33612345678");
  await page.selectOption('[name="sector"]',  "ecommerce");
  await page.fill(
    '[name="description"]',
    "Boutique de mode premium spécialisée dans les pièces durables et artisanales."
  );
}

async function fillStep2(page: Page) {
  await page.fill('[name="agent_name"]',    "Aria");
  await page.fill('[name="agent_tagline"]', "Votre assistante mode premium");
  // Click the "luxury" tone button
  await page.click('button:has-text("Luxe")');
  // Click French language button
  await page.click('button:has-text("Français")');
}

async function fillStep3(page: Page) {
  await page.fill(
    '[name="products_services"]',
    "Robes haute couture, sacs en cuir artisanal, accessoires éco-responsables."
  );
  await page.fill(
    '[name="pricing_info"]',
    "Articles de 49€ à 1200€. Livraison offerte dès 100€."
  );
  await page.fill('[name="business_hours"]', "Lun-Ven 9h-18h CET");
}

async function clickContinue(page: Page) {
  await page.click('button:has-text("Continuer")');
  // Wait for slide animation
  await page.waitForTimeout(500);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Configurator — Agent Creation Journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/configure");
    // Wait for the stepper to render
    await page.waitForSelector('[aria-label="Progression du configurateur"]');
  });

  // ── Step 1: Business form ───────────────────────────────────────────────────

  test("Step 1 — fills business form and advances", async ({ page }) => {
    await fillStep1(page);
    await clickContinue(page);

    // Should now show Step 2 title
    await expect(page.getByText("Personnalité Agent")).toBeVisible();
  });

  // ── Step 1: Validation ──────────────────────────────────────────────────────

  test("Step 1 — shows validation errors on empty submit", async ({ page }) => {
    await page.click('button:has-text("Continuer")');

    await expect(
      page.getByText("Nom requis (min. 2 caractères)")
    ).toBeVisible();
    await expect(page.getByText("Email invalide")).toBeVisible();
  });

  // ── Full journey: Steps 1-5 ─────────────────────────────────────────────────

  test("Full journey — completes all 5 steps and generates prompt preview", async ({
    page,
  }) => {
    // Step 1
    await fillStep1(page);
    await clickContinue(page);

    // Step 2
    await fillStep2(page);
    await clickContinue(page);

    // Step 3
    await fillStep3(page);
    await clickContinue(page);

    // Step 4: enable WhatsApp support toggle
    await page.click('label:has-text("Support WhatsApp")');
    await clickContinue(page);

    // Step 5: select Claude model
    await page.click('button:has-text("Claude 3.5 Sonnet")');

    // Generate prompt preview
    await page.click('button:has-text("Générer")');

    // Preview should appear
    await expect(page.getByText("System Prompt")).toBeVisible();
    await expect(page.getByText("Aria")).toBeVisible();
    // Token count should appear (any number)
    await expect(page.getByText(/~\d+ tokens/)).toBeVisible();
  });

  // ── Step navigation ─────────────────────────────────────────────────────────

  test("Retour button goes back to previous step", async ({ page }) => {
    await fillStep1(page);
    await clickContinue(page);

    // Now on Step 2
    await expect(page.getByText("Personnalité Agent")).toBeVisible();

    await page.click('button:has-text("Retour")');
    await page.waitForTimeout(400);

    // Back on Step 1
    await expect(page.getByText("Votre Entreprise")).toBeVisible();
  });

  // ── Mobile responsiveness ───────────────────────────────────────────────────

  test("Mobile — configurator renders and is usable at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Mobile progress bar should be visible (compact variant)
    await expect(page.getByText(/Étape 1 sur 5/)).toBeVisible();

    await fillStep1(page);
    await page.click('button:has-text("Continuer")');
    await page.waitForTimeout(500);

    await expect(page.getByText(/Étape 2 sur 5/)).toBeVisible();
  });

  // ── FAQ builder ─────────────────────────────────────────────────────────────

  test("Step 3 — FAQ builder adds and removes entries", async ({ page }) => {
    await fillStep1(page);
    await clickContinue(page);
    await fillStep2(page);
    await clickContinue(page);

    // Add FAQ entry
    await page.click('button:has-text("Ajouter une Q&A")');
    await expect(page.locator('[placeholder="Question fréquente..."]')).toBeVisible();

    await page.fill('[placeholder="Question fréquente..."]', "Livrez-vous à l'étranger ?");
    await page.fill('[placeholder="Réponse claire et concise..."]', "Oui, dans 30 pays.");

    // Remove it
    await page.click('button[aria-label]:near(:text("Q1"))');
    await expect(
      page.locator('[placeholder="Question fréquente..."]')
    ).not.toBeVisible();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

test.describe("Accessibility", () => {
  test("Step navigation has correct aria-current attribute", async ({
    page,
  }) => {
    await page.goto("/configure");
    await page.waitForSelector('[aria-current="step"]');

    const currentStep = page.locator('[aria-current="step"]');
    await expect(currentStep).toBeVisible();
  });
});
