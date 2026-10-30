// Asserções mínimas sobre locators do Playwright, sem depender do @playwright/test.
import type { Locator } from "playwright";

const DEFAULT = 5000;

export function expect(locator: Locator) {
  return {
    async toBeVisible(timeout = DEFAULT) {
      await locator.first().waitFor({ state: "visible", timeout });
    },
    async toBeHidden(timeout = DEFAULT) {
      await locator.first().waitFor({ state: "hidden", timeout });
    },
    async toBeAttached(timeout = DEFAULT) {
      await locator.first().waitFor({ state: "attached", timeout });
    },
    async toHaveCount(count: number, timeout = DEFAULT) {
      const deadline = Date.now() + timeout;
      let actual = await locator.count();
      while (actual !== count && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
        actual = await locator.count();
      }
      if (actual !== count) throw new Error(`esperava ${count} elemento(s), encontrou ${actual}`);
    },
  };
}
