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

// 表示中の各行について、商品名セルと商品コードセルのHTMLを期待値と比べる。
// 強調の位置・分割、<code> の保持、強調するのが元の文字列であることを一度に確かめる。
const plainCells = (products) => products.map(([name, code]) => [name, `<code>${code}</code>`]);
const descendingNoteHighlights = [
  ["赤いノート", "<code><mark>NOTE</mark>-002</code>"],
  ["青いノート", "<code><mark>NOTE</mark>-001</code>"],
];

async function expectHighlights(page, cells) {
  const visibleRows = page.locator("tbody tr:not([hidden])");
  await expect.poll(() => visibleRows.evaluateAll((rows) =>
    rows.map((row) => Array.from(row.cells, (cell) => cell.innerHTML)))).toEqual(cells);
  // 非表示の行や表の外にも <mark> を残さない。
  await expect(page.locator("mark")).toHaveCount(cells.flat().join("").split("<mark>").length - 1);
}

const noteHighlights = [
  ["青いノート", "<code><mark>NOTE</mark>-001</code>"],
  ["赤いノート", "<code><mark>NOTE</mark>-002</code>"],
];
const note001Highlight = [["青いノート", "<code><mark>NOTE-001</mark></code>"]];
const pen001Highlight = [["黒いペン", "<code><mark>PEN-001</mark></code>"]];

for (const { query, products, highlights, screenshot } of [
  { query: "   ", products: allProducts, highlights: plainCells(allProducts) },
  {
    query: "ノート",
    products: notes,
    highlights: [["青い<mark>ノート</mark>", "<code>NOTE-001</code>"], ["赤い<mark>ノート</mark>", "<code>NOTE-002</code>"]],
    screenshot: "filtered",
  },
  { query: "あおいのーと", products: [], highlights: [] },
  { query: "青い", products: [["青いノート", "NOTE-001"]], highlights: [["<mark>青い</mark>ノート", "<code>NOTE-001</code>"]] },
  { query: "note", products: notes, highlights: noteHighlights },
  { query: "pEn", products: [["黒いペン", "PEN-001"]], highlights: [["黒いペン", "<code><mark>PEN</mark>-001</code>"]] },
  { query: "  pEn-001  ", products: [["黒いペン", "PEN-001"]], highlights: pen001Highlight },
  {
    query: "0",
    products: allProducts,
    highlights: [
      ["青いノート", "<code>NOTE-<mark>0</mark><mark>0</mark>1</code>"],
      ["赤いノート", "<code>NOTE-<mark>0</mark><mark>0</mark>2</code>"],
      ["黒いペン", "<code>PEN-<mark>0</mark><mark>0</mark>1</code>"],
      ["白いマグ", "<code>MUG-<mark>0</mark><mark>0</mark>1</code>"],
    ],
  },
  { query: "ＮＯＴＥ－００１", products: [["青いノート", "NOTE-001"]], highlights: note001Highlight },
  { query: "ｎＯｔＥ－００１", products: [["青いノート", "NOTE-001"]], highlights: note001Highlight },
  { query: "　ＰＥＮ－００１　", products: [["黒いペン", "PEN-001"]], highlights: pen001Highlight },
  { query: "ＮＯＴＥ", products: notes, highlights: noteHighlights },
  { query: "ＮＯＴＥ－９９９", products: [], highlights: [] },
  { query: "ﾉｰﾄ", products: [], highlights: [] },
  { query: "NOTE−001", products: [], highlights: [] },
  { query: "存在しない商品", products: [], highlights: [], screenshot: "no-results" },
]) {
  test(`検索語 ${JSON.stringify(query)} で表示対象と一致部分の強調が切り替わる`, async ({ page }, testInfo) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await search.fill(query);
    await expectProducts(page, products);
    await expectHighlights(page, highlights);
    await expect(search).toHaveValue(query);
    await expect(search).toBeFocused();
    if (screenshot) {
      await page.screenshot({ path: `trial/artifacts/product-search-${screenshot}-${testInfo.project.name}.png`, fullPage: true });
    }
  });
}

test("キーボードだけで検索欄へ移動し、入力ごとの絞り込みと強調の更新、空白のみ・全削除・該当なしからの復帰ができる", async ({ page }) => {
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
  await expectHighlights(page, note001Highlight);
  // 強調していた行が非表示になっても、その行に <mark> を残さない。
  await page.keyboard.type("x");
  await expectProducts(page, []);
  await expectHighlights(page, []);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await expect(search).toHaveValue("");
  await expectProducts(page, allProducts);
  await page.keyboard.type("mug");
  await expectProducts(page, [["白いマグ", "MUG-001"]]);
  await expectHighlights(page, [["白いマグ", "<code><mark>MUG</mark>-001</code>"]]);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("  ");
  await expectProducts(page, allProducts);
  await expectHighlights(page, plainCells(allProducts));
  await page.keyboard.type("pen");
  await expectProducts(page, [["黒いペン", "PEN-001"]]);
  await expectHighlights(page, [["黒いペン", "<code><mark>PEN</mark>-001</code>"]]);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await expect(search).toHaveValue("");
  await expectProducts(page, allProducts);
  await expectHighlights(page, plainCells(allProducts));
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
    await expectHighlights(page, operation === "pointer" ? [] : descendingNoteHighlights);
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
    await expectHighlights(page, plainCells(reversedProducts));
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
    await expectHighlights(page, query === "note" ? descendingNoteHighlights : []);
    await expect(search).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await expectProducts(page, reversedProducts);
    await expectHighlights(page, plainCells(reversedProducts));
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

test("強調中に再読み込みすると、検索欄が空で強調のない全件表示になる", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  await search.fill("note");
  await expectHighlights(page, noteHighlights);
  await page.reload();
  await expect(search).toHaveValue("");
  await expectProducts(page, allProducts);
  await expectHighlights(page, plainCells(allProducts));
});

test("検索語 <b> では <mark> 以外の要素を生成せず、検索語が重なって一致する箇所は重ねて囲まず、正規化で長さが変わる商品名は強調しない", async ({ page }) => {
  // 配信する商品名・商品コードだけを差し替え、実際の画面の検索・強調処理を通す。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(">青いノート<", ">&lt;b&gt;青いノート<")
      .replace(">赤いノート<", ">İİノート<")
      .replace(">MUG-001<", ">A-000<");
    await route.fulfill({ response, body });
  });
  await page.goto("/");
  const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
  const elementCount = await page.locator("*").count();
  await search.fill("<b>");
  await expect(page.getByText("全4件中1件を表示", { exact: true })).toBeVisible();
  await expectHighlights(page, [["<mark>&lt;b&gt;</mark>青いノート", "<code>NOTE-001</code>"]]);
  await expect(page.locator("b")).toHaveCount(0);
  await expect(page.locator("*")).toHaveCount(elementCount + 1);
  // 「İ」は小文字化で2文字になるため、一致位置を元の商品名へ対応させられない。行は表示し、強調しない。
  await search.fill("ノート");
  await expect(page.getByText("全4件中2件を表示", { exact: true })).toBeVisible();
  await expectHighlights(page, [
    ["&lt;b&gt;青い<mark>ノート</mark>", "<code>NOTE-001</code>"],
    ["İİノート", "<code>NOTE-002</code>"],
  ]);
  // 「000」に対する「00」は2文字目からも一致するが、左から重ならない一致だけを囲む。
  await search.fill("00");
  await expect(page.getByText("全4件中4件を表示", { exact: true })).toBeVisible();
  await expectHighlights(page, [
    ["&lt;b&gt;青いノート", "<code>NOTE-<mark>00</mark>1</code>"],
    ["İİノート", "<code>NOTE-<mark>00</mark>2</code>"],
    ["黒いペン", "<code>PEN-<mark>00</mark>1</code>"],
    ["白いマグ", "<code>A-<mark>00</mark>0</code>"],
  ]);
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
