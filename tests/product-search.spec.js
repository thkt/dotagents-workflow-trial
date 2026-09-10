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

for (const operation of ["pointer", "Enter", "Space"]) {
  test(`${operation}で検索をクリアし、全件復帰と再検索ができる`, async ({ page, hasTouch }, testInfo) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    const clear = page.getByRole("button", { name: "検索をクリア", exact: true });
    // 同じ文書上で操作を完了し、再読み込みで初期状態に戻していないことを確認する。
    let navigations = 0;
    page.on("framenavigated", () => { navigations += 1; });
    for (const { query, products } of [
      { query: "ノート", products: notes },
      { query: "存在しない商品", products: [] },
      { query: "   ", products: allProducts },
      { query: "", products: allProducts },
    ]) {
      await search.fill(query);
      await expectProducts(page, products);
      await expect(clear).toBeVisible();
      await expect(clear).toBeEnabled();
      await expect(clear).toBeInViewport();
      if (operation === "pointer") {
        if (hasTouch) await clear.tap();
        else await clear.click();
      } else {
        await page.keyboard.press("Tab");
        await expect(clear).toBeFocused();
        await page.keyboard.press(operation);
        await expect(clear).toBeFocused();
      }
      await expect(search).toHaveValue("");
      await expectProducts(page, allProducts);
      if (operation !== "pointer") {
        await page.keyboard.press(operation);
        await expect(clear).toBeFocused();
        await expectProducts(page, allProducts);
        if (query === "ノート" && operation === "Enter") {
          await page.screenshot({ path: `artifacts/product-clear-${testInfo.project.name}.png`, fullPage: true });
        }
        await page.keyboard.press("Shift+Tab");
        await expect(search).toBeFocused();
        await page.keyboard.type("mug");
      } else {
        await search.fill("mug");
      }
      await expectProducts(page, [["白いマグ", "MUG-001"]]);
    }
    expect(navigations).toBe(0);
  });
}
