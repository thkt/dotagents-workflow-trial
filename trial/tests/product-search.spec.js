import { expect, test } from "@playwright/test";

// 表示する商品と順序の期待値。実装のデータや検索処理を参照しない。
const allProducts = [
  ["青いノート", "NOTE-001"],
  ["赤いノート", "NOTE-002"],
  ["黒いペン", "PEN-001"],
  ["白いマグ", "MUG-001"],
];
const notes = [["青いノート", "NOTE-001"], ["赤いノート", "NOTE-002"]];
const codeOrderedProducts = [allProducts[3], allProducts[0], allProducts[1], allProducts[2]];

async function expectProducts(page, products, total = 4) {
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("row")).toHaveCount(products.length + 1);
  await expect(table.getByRole("rowheader")).toHaveText(products.map(([name]) => name));
  await expect(table.getByRole("cell")).toHaveText(products.map(([, code]) => code));
  const resultCount = page.getByText(`全${total}件中${products.length}件を表示`, { exact: true });
  await expect(resultCount).toBeVisible();
  const emptyMessage = page.getByText("該当する商品はありません", { exact: true });
  if (products.length === 0) {
    await expect(emptyMessage).toBeVisible();
  } else {
    await expect(emptyMessage).toBeHidden();
  }
}

for (const { query, products, screenshot } of [
  { query: "   ", products: allProducts },
  { query: "ノート", products: notes, screenshot: "filtered" },
  { query: "あおいのーと", products: [] },
  { query: "青い", products: [["青いノート", "NOTE-001"]] },
  { query: "note", products: notes },
  { query: "  pEn-001  ", products: [["黒いペン", "PEN-001"]] },
  { query: "存在しない商品", products: [], screenshot: "no-results" },
]) {
  test(`検索語 ${JSON.stringify(query)} で表示対象が切り替わる`, async ({ page }, testInfo) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await search.fill(query);
    await expectProducts(page, products);
    await expect(search).toBeFocused();
    if (screenshot) {
      await page.screenshot({ path: `trial/artifacts/product-search-${screenshot}-${testInfo.project.name}.png`, fullPage: true });
    }
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

// Click/tap and keyboard activation share the button's click handler.
for (const operation of ["pointer", "Enter"]) {
  test(`${operation}で検索をクリアし、並び順とフォーカスを保って再検索できる`, async ({ page, hasTouch }) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    const clear = page.getByRole("button", { name: "検索をクリア", exact: true });
    const order = page.getByLabel("並び順", { exact: true });
    await order.selectOption("descending");
    await search.fill(operation === "pointer" ? "存在しない商品" : "ノート");
    await expectProducts(page, operation === "pointer" ? [] : [allProducts[1], allProducts[0]]);
    let navigations = 0;
    page.on("framenavigated", () => { navigations += 1; });
    await expect(clear).toBeInViewport();
    if (operation === "pointer") {
      if (hasTouch) await clear.tap();
      else await clear.click();
    } else {
      await page.keyboard.press("Tab");
      await expect(clear).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(clear).toBeFocused();
    }
    await expect(search).toHaveValue("");
    await expect(order).toHaveValue("descending");
    await expectProducts(page, reversedProducts);
    if (operation === "Enter") {
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.type("mug");
    } else {
      await search.fill("mug");
    }
    await expectProducts(page, [["白いマグ", "MUG-001"]]);
    expect(navigations).toBe(0);
  });
}

const reversedProducts = [allProducts[3], allProducts[2], allProducts[1], allProducts[0]];

for (const query of ["note", "missing"]) {
  test(`降順・検索語 ${JSON.stringify(query)} からEscでクリアし、フォーカスと並び順を保って再検索できる`, async ({ page }) => {
    await page.goto("/");
    const order = page.getByLabel("並び順", { exact: true });
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    const orderedNotes = [allProducts[1], allProducts[0]];
    await order.selectOption("descending");
    await search.focus();
    await page.keyboard.type(query);
    await expect(search).toHaveValue(query);
    await expectProducts(page, query === "note" ? orderedNotes : []);
    await expect(search).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await expectProducts(page, reversedProducts);
    await expect(order).toHaveValue("descending");
    await expect(search).toBeFocused();
    // locatorのfill/pressで再フォーカスせず、Esc後の入力先を検証する。
    await page.keyboard.type("note");
    await expect(search).toHaveValue("note");
    await expectProducts(page, orderedNotes);
    await expect(order).toHaveValue("descending");
    await expect(search).toBeFocused();
  });
}

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
});

test("元の順序と名前順が異なる商品でも、昇順・降順・元の順序に切り替えられる", async ({ page }) => {
  // 入力データだけを差し替え、期待値にはアプリの比較関数を使わない。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>
      <tr data-reading="しろいまぐ"><th scope="row">白いマグ</th><td><code>MUG-001</code></td></tr>
      <tr data-reading="あおいのーと"><th scope="row">青いノート</th><td><code>NOTE-001</code></td></tr>
      <tr data-reading="くろいぺん"><th scope="row">黒いペン</th><td><code>PEN-001</code></td></tr>
      <tr data-reading="あかいのーと"><th scope="row">赤いノート</th><td><code>NOTE-002</code></td></tr>
    </tbody>`) });
  });
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  const suppliedOrder = [allProducts[3], allProducts[0], allProducts[2], allProducts[1]];
  await expectProducts(page, suppliedOrder);
  await order.selectOption("ascending");
  await expectProducts(page, allProducts);
  await order.selectOption("descending");
  await expectProducts(page, reversedProducts);
  await order.selectOption("original");
  await expectProducts(page, suppliedOrder);
});

test("並び順は元の順序・商品名の昇順・降順・商品コードの昇順から選べる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("並び順", { exact: true }).getByRole("option"))
    .toHaveText(["元の順序", "商品名：昇順", "商品名：降順", "商品コード：昇順"]);
});

test("商品コード：昇順では商品コード順に表示し、検索・クリア・全削除後も維持する", async ({ page }) => {
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  await order.selectOption({ label: "商品コード：昇順" });
  await expect(order).toHaveValue("code-ascending");
  await expectProducts(page, codeOrderedProducts);
  await search.fill("-001");
  await expectProducts(page, [allProducts[3], allProducts[0], allProducts[2]]);
  await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
  await expectProducts(page, codeOrderedProducts);
  await search.fill("-001");
  await expectProducts(page, [allProducts[3], allProducts[0], allProducts[2]]);
  await search.press("ControlOrMeta+A");
  await search.press("Backspace");
  await expect(search).toHaveValue("");
  await expectProducts(page, codeOrderedProducts);
});

test("商品コードは大文字・小文字を区別した文字列として比較し、同じコードは元の相対順を保つ", async ({ page }) => {
  // PEN-001の2行は先の行の読みが小さく、商品名：降順で入れ替わる。
  // PEN-002の2行は先の行の読みが大きく、商品名：昇順で入れ替わる。どちらも隣り合わない。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>
      <tr data-reading="あおいぺん"><th scope="row">青いペン</th><td><code>PEN-001</code></td></tr>
      <tr data-reading="むらさきのぺん"><th scope="row">紫のペン</th><td><code>PEN-002</code></td></tr>
      <tr data-reading="しろいふせん"><th scope="row">白い付箋</th><td><code>note-003</code></td></tr>
      <tr data-reading="きいろいのーと"><th scope="row">黄色いノート</th><td><code>NOTE-10</code></td></tr>
      <tr data-reading="あかいぺん"><th scope="row">赤いペン</th><td><code>PEN-002</code></td></tr>
      <tr data-reading="みどりのーと"><th scope="row">緑のノート</th><td><code>NOTE-2</code></td></tr>
      <tr data-reading="くろいぺん"><th scope="row">黒いペン</th><td><code>PEN-001</code></td></tr>
    </tbody>`) });
  });
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  const codeOrder = [
    ["黄色いノート", "NOTE-10"],
    ["緑のノート", "NOTE-2"],
    ["青いペン", "PEN-001"],
    ["黒いペン", "PEN-001"],
    ["紫のペン", "PEN-002"],
    ["赤いペン", "PEN-002"],
    ["白い付箋", "note-003"],
  ];
  await order.selectOption({ label: "商品名：降順" });
  await expectProducts(page, [
    ["紫のペン", "PEN-002"],
    ["緑のノート", "NOTE-2"],
    ["白い付箋", "note-003"],
    ["黒いペン", "PEN-001"],
    ["黄色いノート", "NOTE-10"],
    ["赤いペン", "PEN-002"],
    ["青いペン", "PEN-001"],
  ], 7);
  await order.selectOption({ label: "商品コード：昇順" });
  await expect(order).toHaveValue("code-ascending");
  await expectProducts(page, codeOrder, 7);
  await order.selectOption({ label: "商品名：昇順" });
  await expectProducts(page, [
    ["青いペン", "PEN-001"],
    ["赤いペン", "PEN-002"],
    ["黄色いノート", "NOTE-10"],
    ["黒いペン", "PEN-001"],
    ["白い付箋", "note-003"],
    ["緑のノート", "NOTE-2"],
    ["紫のペン", "PEN-002"],
  ], 7);
  await order.selectOption({ label: "商品コード：昇順" });
  await expectProducts(page, codeOrder, 7);
});
