import { expect, test } from "@playwright/test";

// 表示する商品と順序の期待値。実装のデータや検索処理を参照しない。
const allProducts = [
  ["青いノート", "NOTE-001"],
  ["赤いノート", "NOTE-002"],
  ["黒いペン", "PEN-001"],
  ["白いマグ", "MUG-001"],
];
const notes = [["青いノート", "NOTE-001"], ["赤いノート", "NOTE-002"]];

async function expectProducts(page, products) {
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("row")).toHaveCount(products.length + 1);
  await expect(table.getByRole("rowheader")).toHaveText(products.map(([name]) => name));
  await expect(table.getByRole("cell")).toHaveText(products.map(([, code]) => code));
  for (const [name, code] of products) {
    await expect(table.getByRole("rowheader", { name, exact: true })).toBeInViewport();
    await expect(table.getByRole("cell", { name: code, exact: true })).toBeInViewport();
  }
  const resultCount = page.getByText(`全4件中${products.length}件を表示`, { exact: true });
  await expect(resultCount).toBeVisible();
  await expect(resultCount).toBeInViewport();
  const emptyMessage = page.getByText("該当する商品はありません", { exact: true });
  if (products.length === 0) {
    await expect(emptyMessage).toBeVisible();
  } else {
    await expect(emptyMessage).toBeHidden();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const { query, products, screenshot } of [
  { query: "", products: allProducts },
  { query: "   ", products: allProducts },
  { query: "ノート", products: notes, screenshot: "filtered" },
  { query: "青い", products: [["青いノート", "NOTE-001"]] },
  { query: "note", products: notes },
  { query: "  pEn-001  ", products: [["黒いペン", "PEN-001"]] },
  { query: "存在しない商品", products: [], screenshot: "no-results" },
]) {
  test(`検索語 ${JSON.stringify(query)} で絞り込み、全削除で一覧に戻る`, async ({ page }, testInfo) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await expectProducts(page, allProducts);
    // 空文字も、絞り込みから実際に入力を変えて確認する。
    await search.fill("青い");
    await expectProducts(page, [["青いノート", "NOTE-001"]]);
    await search.fill(query);
    await expectProducts(page, products);
    await expect(search).toBeFocused();
    if (screenshot) {
      await page.screenshot({ path: `artifacts/product-search-${screenshot}-${testInfo.project.name}.png`, fullPage: true });
    }
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await expect(search).toHaveValue("");
    await expectProducts(page, allProducts);
    await expect(search).toBeFocused();
  });
}

test("キーボードだけで検索欄へ移動し、入力ごとの更新と該当なしからの復帰ができる", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.type("n");
  await expectProducts(page, [...notes, ["黒いペン", "PEN-001"]]);
  await page.keyboard.type("ote");
  await expectProducts(page, notes);
  await page.keyboard.type("-001");
  await expectProducts(page, [["青いノート", "NOTE-001"]]);
  await page.keyboard.type("x");
  await expectProducts(page, []);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await expect(search).toHaveValue("");
  await expectProducts(page, allProducts);
  await page.keyboard.type("mug");
  await expectProducts(page, [["白いマグ", "MUG-001"]]);
  await expect(search).toBeFocused();
});

const reversedProducts = [allProducts[3], allProducts[2], allProducts[1], allProducts[0]];

test("並び順の切り替え、検索、0件・1件からの復帰と再読み込み", async ({ page }, testInfo) => {
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  let navigations = 0;
  page.on("framenavigated", () => { navigations += 1; });
  await expect(order).toHaveValue("original");
  await expectProducts(page, allProducts);
  await order.selectOption("descending");
  await expectProducts(page, reversedProducts);
  await page.screenshot({ path: `artifacts/product-order-${testInfo.project.name}.png`, fullPage: true });
  await search.fill("ノート");
  await expectProducts(page, [allProducts[1], allProducts[0]]);
  await order.selectOption("ascending");
  await expectProducts(page, notes);
  await order.selectOption("descending");
  await expectProducts(page, [allProducts[1], allProducts[0]]);
  for (const { query, products } of [
    { query: "青い", products: [allProducts[0]] },
    { query: "見つからない", products: [] },
    { query: "あおいのーと", products: [] },
    { query: "", products: reversedProducts },
  ]) {
    await search.fill(query);
    await expect(order).toHaveValue("descending");
    await expectProducts(page, products);
  }
  await order.selectOption("original");
  await expectProducts(page, allProducts);
  await search.fill("見つからない");
  await order.selectOption("ascending");
  await expectProducts(page, []);
  await search.fill("PEN-001");
  await order.selectOption("descending");
  await expectProducts(page, [allProducts[2]]);
  await search.fill("");
  expect(navigations).toBe(0);
  await page.reload();
  await expect(order).toHaveValue("original");
  await expectProducts(page, allProducts);
});

test.describe("モバイルの標準選択UI", () => {
  test.use({ isMobile: true, hasTouch: true });

  test("キーボードで並び順を選び、フォーカスを保って操作を続けられる", async ({ page }) => {
    await page.goto("/");
    const order = page.getByLabel("並び順", { exact: true });
    await order.focus();
    await expect(order).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(order).toHaveValue("descending");
    await expectProducts(page, reversedProducts);
    await expect(order).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expectProducts(page, allProducts);
    await expect(order).toBeFocused();
  });

});

test("同じ読みの商品は昇順・降順とも元の相対順を保つ", async ({ page }) => {
  // 配信する商品データだけを変更し、実際の画面と並べ替え処理を通す。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("あかいのーと", "あおいのーと") });
  });
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  await order.selectOption("descending");
  await expectProducts(page, [allProducts[3], allProducts[2], allProducts[0], allProducts[1]]);
  await order.selectOption("ascending");
  await expectProducts(page, allProducts);
  await order.selectOption("descending");
  await order.selectOption("original");
  await expectProducts(page, allProducts);
});

test.describe("タッチ操作", () => {
  test.use({ isMobile: true, hasTouch: true });
  test("並び順をタップして選択できる", async ({ page }) => {
    await page.goto("/");
    const order = page.getByLabel("並び順", { exact: true });
    await order.tap();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(order).toHaveValue("descending");
    await expectProducts(page, reversedProducts);
  });
});
