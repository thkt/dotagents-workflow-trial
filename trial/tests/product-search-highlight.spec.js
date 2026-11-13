import { expect, test } from "@playwright/test";

// Issue #193 の要求から書いた期待値。実装の正規化関数で生成しない。
// 各商品: [商品名, 商品名内の<mark>の文字列, 商品コード, 商品コード内の<mark>の文字列]
const none = [];
const ascendingNotes = (nameMarks, codeMarks) => [
  ["青いノート", nameMarks, "NOTE-001", codeMarks],
  ["赤いノート", nameMarks, "NOTE-002", codeMarks],
];
const allUnmarked = [
  ["青いノート", none, "NOTE-001", none],
  ["赤いノート", none, "NOTE-002", none],
  ["黒いペン", none, "PEN-001", none],
  ["白いマグ", none, "MUG-001", none],
];

async function expectHighlights(page, products) {
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  // 強調中も表示文字列（textContent）は元と同じ。
  await expect(table.getByRole("rowheader")).toHaveText(products.map(([name]) => name));
  await expect(table.getByRole("cell")).toHaveText(products.map(([, , code]) => code));
  for (const [name, nameMarks, , codeMarks] of products) {
    const row = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });
    await expect(row.getByRole("rowheader").locator("mark")).toHaveText(nameMarks);
    // code要素の中に強調があることで、商品コードの<code>が残っていることも確認する。
    await expect(row.locator("td code mark")).toHaveText(codeMarks);
  }
  // 非表示の行を含め、一覧に余分な<mark>が残っていない。
  const markCount = products.reduce((sum, [, nameMarks, , codeMarks]) => sum + nameMarks.length + codeMarks.length, 0);
  await expect(table.locator("mark")).toHaveCount(markCount);
}

for (const { query, products } of [
  { query: "ノート", products: ascendingNotes(["ノート"], none) },
  { query: "ＮＯＴＥ", products: ascendingNotes(none, ["NOTE"]) },
  { query: "note", products: ascendingNotes(none, ["NOTE"]) },
  {
    query: "0",
    products: [
      ["青いノート", none, "NOTE-001", ["0", "0"]],
      ["赤いノート", none, "NOTE-002", ["0", "0"]],
      ["黒いペン", none, "PEN-001", ["0", "0"]],
      ["白いマグ", none, "MUG-001", ["0", "0"]],
    ],
  },
]) {
  test(`検索語 ${JSON.stringify(query)} の一致部分を表示中の元の文字で強調する`, async ({ page }) => {
    await page.goto("/");
    await expectHighlights(page, allUnmarked);
    await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill(query);
    await expectHighlights(page, products);
  });
}

test("検索語を変えると前回の強調を外し、今回の一致だけを強調する", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  await search.fill("ノート");
  await expectHighlights(page, ascendingNotes(["ノート"], none));
  await search.fill("青い");
  await expectHighlights(page, [["青いノート", ["青い"], "NOTE-001", none]]);
});

test("全削除・検索をクリア・Esc・空白のみの入力で強調が残らない", async ({ page, hasTouch }) => {
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  const clear = page.getByRole("button", { name: "検索をクリア", exact: true });
  for (const clearSearch of [
    async () => {
      await search.press("ControlOrMeta+A");
      await search.press("Backspace");
    },
    async () => {
      if (hasTouch) await clear.tap();
      else await clear.click();
    },
    () => page.keyboard.press("Escape"),
    () => search.fill("   "),
  ]) {
    await search.fill("ノート");
    await expectHighlights(page, ascendingNotes(["ノート"], none));
    await clearSearch();
    await expectHighlights(page, allUnmarked);
  }
});

test("強調中に並び順を変えても、同じ商品の同じ文字に強調が残る", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill("ノート");
  await page.getByLabel("並び順", { exact: true }).selectOption("descending");
  await expectHighlights(page, ascendingNotes(["ノート"], none).reverse());
});

test("商品名に含まれるHTMLに似た文字列も、検索語に一致した文字として強調する", async ({ page }) => {
  // 配信する商品名だけを差し替え、検索語や商品名をHTMLとして解釈しないことを確認する。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("白いマグ", "白い&lt;b&gt;マグ") });
  });
  await page.goto("/");
  await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill("<b>");
  await expectHighlights(page, [["白い<b>マグ", ["<b>"], "MUG-001", none]]);
});
