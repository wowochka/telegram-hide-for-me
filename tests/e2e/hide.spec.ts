/**
 * The feature end to end in a real browser: the menu, folding, the header,
 * Undo, peeking, new messages, the mention/reply exception and persistence.
 */
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__chat);
}

/** Opens the context menu on the last text message from someone. */
async function menuOn(page: Page, from: string) {
  const bubble = page.locator(`[data-tid="message"][data-from="${from}"] [data-tid="bubble"]`).last();
  await bubble.click({ button: 'right' });
  await expect(page.getByTestId('menu')).toBeVisible();
}

async function hideMax(page: Page, duration: 'hour' | 'today' | 'always' = 'always') {
  await menuOn(page, 'max');
  await page.locator('[data-tid="menu-hide"]').click();
  await page.locator(`[data-tid="menu-${duration}"]`).click();
  await expect(page.locator('[data-tid="message"][data-from="max"]')).toHaveCount(0);
}

test.use({ testIdAttribute: 'data-tid' });

test('the menu offers Hide for Me on other people’s messages only', async ({ page }) => {
  await open(page);
  await menuOn(page, 'max');
  await expect(page.locator('[data-tid="menu-hide"]')).toHaveText(/Hide Max for Me/);
  await page.getByTestId('menu-backdrop').click({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('menu')).toHaveCount(0);

  await menuOn(page, 'alex');
  await expect(page.locator('[data-tid="menu-hide"]')).toHaveCount(0);
});

test('a long press opens the menu too', async ({ page }) => {
  await open(page);
  const bubble = page.locator('[data-tid="message"][data-from="max"] [data-tid="bubble"]').last();
  const box = (await bubble.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.getByTestId('menu')).toBeVisible();
});

test('hiding folds his messages into rows, says so in the header, and can be undone', async ({ page }) => {
  await open(page);
  const before = await page.locator('[data-tid="message"][data-from="max"]').count();
  expect(before).toBeGreaterThan(5);

  await hideMax(page, 'today');
  const rows = page.getByTestId('hidden-row');
  await expect(rows).toHaveCount(4);
  const counts = await rows.evaluateAll((list) => list.map((row) => Number(row.getAttribute('data-count'))));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(before);
  await expect(page.getByTestId('nav-sub')).toContainText('1 hidden');
  await expect(page.getByTestId('toast')).toContainText('Max is hidden for you');
  await expect(page.getByTestId('toast')).toContainText('Until tomorrow');

  await page.getByTestId('toast-undo').click();
  await expect(page.locator('[data-tid="message"][data-from="max"]')).toHaveCount(before);
  await expect(page.getByTestId('hidden-row')).toHaveCount(0);
  await expect(page.getByTestId('nav-sub')).not.toContainText('hidden');
});

test('peeking shows the hidden messages in place, dimmed, and folds them again', async ({ page }) => {
  await open(page);
  await hideMax(page);
  const row = page.getByTestId('hidden-row').nth(1);
  const count = Number(await row.getAttribute('data-count'));
  const pill = row.locator('button');
  await expect(pill).toHaveAttribute('aria-expanded', 'false');

  await pill.click();
  await expect(pill).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-tid="message"][data-peek="true"]')).toHaveCount(count);

  await pill.click();
  await expect(page.locator('[data-tid="message"][data-peek="true"]')).toHaveCount(0);
});

test('new messages from him join the row; a reply or mention to you still shows', async ({ page }) => {
  await open(page);
  await hideMax(page);
  const last = page.getByTestId('hidden-row').last();
  const count = Number(await last.getAttribute('data-count'));

  await page.evaluate(() => {
    const push = (id: string, text: string, extra = {}) =>
      window.__chat!.push({ id, from: 'max', sentAt: Date.now(), content: { kind: 'text', text }, ...extra });
    push('t1', 'still here');
    push('t2', 'and here');
  });
  await expect(page.getByTestId('hidden-row').last()).toHaveAttribute('data-count', String(count + 2));
  await expect(page.locator('[data-tid="message"][data-from="max"]')).toHaveCount(0);

  await page.evaluate(() => {
    const mine = window.__chat!.messages().find((m) => m.from === 'alex')!;
    window.__chat!.push({ id: 't3', from: 'max', sentAt: Date.now(), content: { kind: 'text', text: 'Alex you’re the best' }, replyTo: mine.id });
    window.__chat!.push({ id: 't4', from: 'max', sentAt: Date.now(), content: { kind: 'text', text: '@alex bring snacks' }, mentions: ['alex'] });
  });
  const visible = page.locator('[data-tid="message"][data-from="max"]');
  await expect(visible).toHaveCount(2);
  await expect(visible.first()).toContainText('Alex you’re the best');
  await expect(visible.first().getByTestId('quote')).toContainText('I’ll bring the speaker');
});

test('the rule survives a reload', async ({ page }) => {
  await open(page);
  await hideMax(page);
  await page.reload();
  await page.waitForFunction(() => !!window.__chat);
  await expect(page.locator('[data-tid="message"][data-from="max"]')).toHaveCount(0);
  await expect(page.getByTestId('hidden-row')).toHaveCount(4);
});
