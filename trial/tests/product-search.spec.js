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
  const resultCount = page.getByText(`全4件中${products.length}件を表示`, { exact: true });
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
  { query: "ＮＯＴＥ－００１", products: [["青いノート", "NOTE-001"]] },
  { query: "ｎＯｔＥ－００１", products: [["青いノート", "NOTE-001"]] },
  { query: "　ＰＥＮ－００１　", products: [["黒いペン", "PEN-001"]] },
  { query: "ＮＯＴＥ", products: notes },
  { query: "ＮＯＴＥ－９９９", products: [] },
  { query: "ﾉｰﾄ", products: [] },
  { query: "NOTE−001", products: [] },
  { query: "存在しない商品", products: [], screenshot: "no-results" },
]) {
  test(`検索語 ${JSON.stringify(query)} で表示対象が切り替わる`, async ({ page }, testInfo) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await search.fill(query);
    await expectProducts(page, products);
    await expect(search).toHaveValue(query);
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
    await search.fill(operation === "pointer" ? "存在しない商品" : "ＮＯＴＥ");
    await expect(search).toHaveValue(operation === "pointer" ? "存在しない商品" : "ＮＯＴＥ");
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

// 非表示行を含む全行の商品名と商品コード内のHTMLを、画面の行順で比べる。<mark>の位置と囲む表示文字を確かめる。
async function expectHighlights(page, products) {
  const rows = page.locator("tbody tr");
  await expect.poll(() => rows.evaluateAll((elements) => elements.map((row) => [
    row.querySelector("th").innerHTML,
    row.querySelector("td > code").innerHTML,
  ]))).toEqual(products);
  const markCount = products.flat().join("").split("<mark>").length - 1;
  await expect(page.locator("mark")).toHaveCount(markCount);
}

const zeroMarked = [
  ["青いノート", "NOTE-<mark>0</mark><mark>0</mark>1"],
  ["赤いノート", "NOTE-<mark>0</mark><mark>0</mark>2"],
  ["黒いペン", "PEN-<mark>0</mark><mark>0</mark>1"],
  ["白いマグ", "MUG-<mark>0</mark><mark>0</mark>1"],
];
const noteCodeMarked = [
  ["青いノート", "<mark>NOTE</mark>-001"],
  ["赤いノート", "<mark>NOTE</mark>-002"],
  allProducts[2],
  allProducts[3],
];

for (const { query, highlights } of [
  { query: "ノート", highlights: [["青い<mark>ノート</mark>", "NOTE-001"], ["赤い<mark>ノート</mark>", "NOTE-002"], allProducts[2], allProducts[3]] },
  { query: "ＮＯＴＥ", highlights: noteCodeMarked },
  { query: "　ＰＥＮ－００１　", highlights: [allProducts[0], allProducts[1], ["黒いペン", "<mark>PEN-001</mark>"], allProducts[3]] },
]) {
  test(`検索語 ${JSON.stringify(query)} の一致部分を商品名・商品コード内の<mark>で囲む`, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill(query);
    await expectHighlights(page, highlights);
  });
}

for (const { path, emptySearch } of [
  { path: "空白のみの入力", emptySearch: (page, search) => search.fill("   ") },
  { path: "全削除", emptySearch: async (page) => {
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
  } },
  { path: "検索をクリアボタン", emptySearch: (page) => page.getByRole("button", { name: "検索をクリア", exact: true }).click() },
  { path: "Esc", emptySearch: (page) => page.keyboard.press("Escape") },
  { path: "再読み込み", emptySearch: (page) => page.reload() },
]) {
  test(`${path}で検索語を空にすると<mark>が残らない`, async ({ page }) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await search.focus();
    await page.keyboard.type("note");
    await expectHighlights(page, noteCodeMarked);
    await emptySearch(page, search);
    await expectProducts(page, allProducts);
    await expectHighlights(page, allProducts);
  });
}

test("該当なしにした時点で非表示行の<mark>を消し、クリア後も残さない", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  await search.focus();
  await page.keyboard.type("note");
  await expectHighlights(page, noteCodeMarked);
  await page.keyboard.type("x");
  await expectProducts(page, []);
  await expectHighlights(page, allProducts);
  await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
  await expectProducts(page, allProducts);
  await expectHighlights(page, allProducts);
});

test("検索語があるまま並び順を切り替えても、同じ商品の同じ部分を<mark>で囲む", async ({ page }) => {
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill("0");
  await expectHighlights(page, zeroMarked);
  await order.selectOption("descending");
  await expectHighlights(page, zeroMarked.toReversed());
  await order.selectOption("ascending");
  await expectHighlights(page, zeroMarked);
  await order.selectOption("original");
  await expectHighlights(page, zeroMarked);
});

test("商品データの全角英数字も変換前の文字のまま囲み、重なる一致は囲まない", async ({ page }) => {
  // 配信する商品コードだけを全角を含む値へ差し替え、実際の画面処理を通す。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("<code>NOTE-002</code>", "<code>ＮＯＴＥ-000</code>") });
  });
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  await search.fill("note-0");
  await expectHighlights(page, [
    ["青いノート", "<mark>NOTE-0</mark>01"],
    ["赤いノート", "<mark>ＮＯＴＥ-0</mark>00"],
    allProducts[2],
    allProducts[3],
  ]);
  await search.fill("00");
  await expectHighlights(page, [
    ["青いノート", "NOTE-<mark>00</mark>1"],
    ["赤いノート", "ＮＯＴＥ-<mark>00</mark>0"],
    ["黒いペン", "PEN-<mark>00</mark>1"],
    ["白いマグ", "MUG-<mark>00</mark>1"],
  ]);
});
