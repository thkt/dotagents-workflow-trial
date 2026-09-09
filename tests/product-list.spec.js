import { expect, test } from "@playwright/test";

// Issue #9 の固定データ。実装のデータや HTML を期待値として読み込まない。
const expectedProducts = [
  ["青いノート", "NOTE-001"],
  ["赤いノート", "NOTE-002"],
  ["黒いペン", "PEN-001"],
  ["白いマグ", "MUG-001"],
];

test("全商品の名前とコードを見出し付きの一覧で記載順に読める", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "商品一覧", level: 1 })).toBeVisible();
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("columnheader")).toHaveText(["商品名", "商品コード"]);
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(expectedProducts.length + 1);

  for (const [index, [name, code]] of expectedProducts.entries()) {
    const row = rows.nth(index + 1);
    const productName = row.getByRole("rowheader");
    const productCode = row.getByRole("cell");
    await expect(productName).toHaveText(name);
    await expect(productCode).toHaveText(code);
    await expect(productName).toBeVisible();
    await expect(productCode).toBeVisible();
    await expect(productName).toBeInViewport();
    await expect(productCode).toBeInViewport();
  }

  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/product-list-${testInfo.project.name}.png`, fullPage: true });
});
