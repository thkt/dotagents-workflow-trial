import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const storageKey = "product-order";
// 合意した固定期待値。アプリの比較関数・HTMLから生成しない。
const original = [
  ["青いノート", "NOTE-001"],
  ["赤いノート", "NOTE-002"],
  ["黒いペン", "PEN-001"],
  ["白いマグ", "MUG-001"],
];
const descending = [original[3], original[2], original[1], original[0]];
const productsFor = (value) => value === "descending" ? descending : original;
const orderControl = (page) => page.getByLabel("並び順", { exact: true });
const searchControl = (page) => page.getByLabel("商品名・商品コードで検索", { exact: true });

async function expectState(page, value, products = productsFor(value), query = "") {
  await expect(orderControl(page)).toHaveValue(value);
  await expect(searchControl(page)).toHaveValue(query);
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(products.length + 1);
  for (const [index, [name, code]] of products.entries()) {
    await expect(rows.nth(index + 1).getByRole("rowheader")).toHaveText(name);
    await expect(rows.nth(index + 1).getByRole("cell")).toHaveText(code);
  }
  await expect(page.getByText(`全4件中${products.length}件を表示`, { exact: true })).toBeVisible();
  await expect(page.getByText("該当する商品はありません", { exact: true })).toBeVisible({ visible: products.length === 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function savedOrder(page) {
  return page.evaluate((key) => localStorage.getItem(key), storageKey);
}

for (const value of ["original", "ascending", "descending"]) {
  test(`${value}を選ぶと直ちに保存し、再読み込みとタブ再オープンで検索語なしに復元する`, async ({ page, context }) => {
    await page.goto("/");
    await expectState(page, "original");
    expect(await savedOrder(page)).toBeNull();
    await orderControl(page).selectOption("descending");
    await orderControl(page).selectOption(value);
    await expectState(page, value);
    expect(await savedOrder(page)).toBe(value);
    await searchControl(page).fill("ノート");
    expect(await page.evaluate(() => Object.entries(localStorage))).toEqual([[storageKey, value]]);
    await page.reload();
    await expectState(page, value);
    await searchControl(page).fill("PEN-001");
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto("/");
    await expectState(reopened, value);
  });
}

for (const value of [null, "", "unsupported", "ASCENDING", '"descending"', " descending ", "__proto__"]) {
  test(`保存値 ${JSON.stringify(value)} は元の順序で開始する`, async ({ page }) => {
    await page.goto("/");
    await orderControl(page).selectOption("descending");
    await page.evaluate(({ key, value }) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }, { key: storageKey, value });
    await page.reload();
    await expectState(page, "original");
    await orderControl(page).selectOption("ascending");
    await page.reload();
    await expectState(page, "ascending");
  });
}

for (const query of ["見つからない", "PEN-001"]) {
  for (const value of ["original", "ascending", "descending"]) {
    test(`${query}の結果で${value}を保存し、クリア・全削除で維持する`, async ({ page }) => {
      await page.goto("/");
      await orderControl(page).selectOption("descending");
      await page.reload();
      await searchControl(page).fill(query);
      await orderControl(page).selectOption(value);
      await expectState(page, value, query === "PEN-001" ? [original[2]] : [], query);
      expect(await savedOrder(page)).toBe(value);
      await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
      await expectState(page, value);
      expect(await savedOrder(page)).toBe(value);
      await searchControl(page).fill("ノート");
      await expectState(page, value, value === "descending" ? [original[1], original[0]] : [original[0], original[1]], "ノート");
      await searchControl(page).press("ControlOrMeta+A");
      await searchControl(page).press("Backspace");
      await expectState(page, value);
      expect(await savedOrder(page)).toBe(value);
      await searchControl(page).fill(query);
      await page.reload();
      await expectState(page, value);
    });
  }
}

for (const failure of ["access", "read", "write"]) {
  test(`Storage境界の${failure}例外でも初期表示・操作を継続し、保存成功値だけを復元する`, async ({ page, context }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await orderControl(page).selectOption("descending");
    // 実ブラウザー内のAPI境界で例外を注入。ブラウザー設定による拒否とは区別する。
    await page.addInitScript((failure) => {
      if (failure === "access") {
        Object.defineProperty(window, "localStorage", {
          get() { throw new DOMException("Storage denied in test", "SecurityError"); },
        });
      } else {
        const method = failure === "read" ? "getItem" : "setItem";
        Storage.prototype[method] = () => {
          throw new DOMException("Storage failure in test", failure === "read" ? "SecurityError" : "QuotaExceededError");
        };
      }
    }, failure);
    await page.reload();
    await expectState(page, failure === "write" ? "descending" : "original");
    await orderControl(page).selectOption("ascending");
    await expectState(page, "ascending");
    await searchControl(page).fill("note");
    await expectState(page, "ascending", [original[0], original[1]], "note");
    await orderControl(page).selectOption("descending");
    await expectState(page, "descending", [original[1], original[0]], "note");
    await searchControl(page).fill("不一致");
    await expectState(page, "descending", [], "不一致");
    await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
    await expectState(page, "descending");
    await orderControl(page).selectOption("ascending");
    await page.reload();
    await expectState(page, failure === "write" ? "descending" : "original");
    expect(errors).toEqual([]);
    // page限定の例外注入がないタブで、実際に残った値を確認する。
    const healthy = await context.newPage();
    await healthy.goto("/");
    await expectState(healthy, failure === "read" ? "ascending" : "descending");
  });
}

test("保存値なしの書込失敗でも3種類を適用でき、次回は元の順序になる", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage full in test", "QuotaExceededError"); };
  });
  await page.goto("/");
  await expectState(page, "original");
  for (const value of ["descending", "original", "ascending"]) {
    await orderControl(page).selectOption(value);
    await expectState(page, value);
    expect(await savedOrder(page)).toBeNull();
  }
  await searchControl(page).fill("note");
  await page.reload();
  await expectState(page, "original");
});

test("複数タブは即時同期せず、次の読み込みで最後の保存成功値を使う", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  // storageイベントが到着してから、即時同期していないことを確認する。
  await other.evaluate(() => {
    window.nextStorageEvent = new Promise((resolve) => {
      window.addEventListener("storage", () => resolve(), { once: true });
    });
  });
  await orderControl(page).selectOption("descending");
  await other.evaluate(() => window.nextStorageEvent);
  await expectState(other, "original");
  await other.reload();
  await expectState(other, "descending");
  await page.evaluate(() => {
    window.nextStorageEvent = new Promise((resolve) => {
      window.addEventListener("storage", () => resolve(), { once: true });
    });
  });
  await orderControl(other).selectOption("ascending");
  await page.evaluate(() => window.nextStorageEvent);
  await expectState(page, "descending");
  await orderControl(page).selectOption("original");
  expect(await savedOrder(page)).toBe("original");
  await other.reload();
  await expectState(other, "original");
  await page.reload();
  await expectState(page, "original");
});

test.describe("復元後の標準選択UI", () => {
  // 既存のキー操作テストと同じモバイルUIを両画面幅で使用する。
  test.use({ isMobile: true, hasTouch: true });

  test("復元後もキーボードでselectを操作でき、遷移とフォーカス移動を加えない", async ({ page }) => {
    await page.goto("/");
    await orderControl(page).selectOption("descending");
    await page.reload();
    await expectState(page, "descending");
    let navigations = 0;
    page.on("framenavigated", () => { navigations += 1; });
    await page.keyboard.press("Tab");
    await expect(searchControl(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(orderControl(page)).toBeFocused();
    // Chromiumのモバイルselectはポップアップを開いて確定する。
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expectState(page, "ascending");
    await expect(orderControl(page)).toBeFocused();
    expect(await savedOrder(page)).toBe("ascending");
    expect(navigations).toBe(0);
  });
});

for (const value of ["original", "ascending", "descending"]) {
  test(`${value}を同じ永続プロファイルのブラウザー終了・再起動で復元し別プロファイルに引き継がない`, async ({ playwright, baseURL, viewport, isMobile, hasTouch }) => {
    test.setTimeout(60000);
    const profile = await mkdtemp(join(tmpdir(), "product-order-profile-"));
    const separateProfile = await mkdtemp(join(tmpdir(), "product-order-separate-"));
    const options = { baseURL, viewport, isMobile, hasTouch, headless: true };
    let browserContext;
    try {
      browserContext = await playwright.chromium.launchPersistentContext(profile, options);
      const first = await browserContext.newPage();
      await first.goto("/");
      await expectState(first, "original");
      await orderControl(first).selectOption("descending");
      await orderControl(first).selectOption(value);
      expect(await savedOrder(first)).toBe(value);
      await searchControl(first).fill("ノート");
      // closeは永続contextを所有するブラウザープロセスも終了する。
      await browserContext.close();
      browserContext = await playwright.chromium.launchPersistentContext(profile, options);
      const restarted = await browserContext.newPage();
      await restarted.goto("/");
      await expectState(restarted, value);
      expect(await savedOrder(restarted)).toBe(value);
      await browserContext.close();
      browserContext = await playwright.chromium.launchPersistentContext(separateProfile, options);
      const separate = await browserContext.newPage();
      await separate.goto("/");
      await expectState(separate, "original");
      expect(await savedOrder(separate)).toBeNull();
    } finally {
      await browserContext?.close();
      await rm(profile, { recursive: true, force: true });
      await rm(separateProfile, { recursive: true, force: true });
    }
  });
}
