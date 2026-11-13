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

// 強調の期待値は要求の例から固定し、実装の正規化処理を使わない。
async function expectMarks(page, { names, codes }) {
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("rowheader").locator("mark")).toHaveText(names);
  await expect(table.locator("td > code > mark")).toHaveText(codes);
  await expect(table.locator("mark")).toHaveCount(names.length + codes.length);
}

for (const { query, products, marks } of [
  { query: "ノート", products: notes, marks: { names: ["ノート", "ノート"], codes: [] } },
  { query: "note", products: notes, marks: { names: [], codes: ["NOTE", "NOTE"] } },
  { query: "ＮＯＴＥ", products: notes, marks: { names: [], codes: ["NOTE", "NOTE"] } },
  { query: "  pEn-001  ", products: [["黒いペン", "PEN-001"]], marks: { names: [], codes: ["PEN-001"] } },
  // 隣り合う一致も1つにまとめず、セル内の一致ごとに囲む。
  { query: "0", products: allProducts, marks: { names: [], codes: Array(8).fill("0") } },
]) {
  test(`検索語 ${JSON.stringify(query)} の一致部分を、名前・セル構造を保って強調する`, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill(query);
    await expectProducts(page, products);
    await expectMarks(page, marks);
    // toHaveTextはアクセシブルネームとcode要素の有無を確かめないため、別に確認する。
    const table = page.getByRole("table", { name: "商品一覧", exact: true });
    for (const [name, code] of products) {
      await expect(table.getByRole("rowheader", { name, exact: true })).toBeVisible();
      await expect(table.getByRole("cell", { name: code, exact: true }).locator("code")).toHaveText(code);
    }
  });
}

for (const operation of ["空白だけの入力", "クリア", "Esc", "全削除"]) {
  test(`強調中に${operation}で検索語を空にすると、一覧に強調が残らない`, async ({ page }) => {
    await page.goto("/");
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await search.fill("note");
    await expectMarks(page, { names: [], codes: ["NOTE", "NOTE"] });
    if (operation === "空白だけの入力") {
      await search.fill("   ");
    } else if (operation === "クリア") {
      await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
    } else if (operation === "Esc") {
      await page.keyboard.press("Escape");
    } else {
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.press("Backspace");
    }
    await expect(search).toHaveValue(operation === "空白だけの入力" ? "   " : "");
    await expectProducts(page, allProducts);
    await expect(page.getByRole("table", { name: "商品一覧", exact: true }).locator("mark")).toHaveCount(0);
  });
}

test("並び順を変更した後も、現在の検索語の強調を保つ", async ({ page }) => {
  await page.goto("/");
  const order = page.getByLabel("並び順", { exact: true });
  await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill("note");
  await order.selectOption("descending");
  await expectProducts(page, [allProducts[1], allProducts[0]]);
  await expectMarks(page, { names: [], codes: ["NOTE", "NOTE"] });
  await order.selectOption("original");
  await expectProducts(page, notes);
  await expectMarks(page, { names: [], codes: ["NOTE", "NOTE"] });
});

test("HTMLに見える検索語は要素を生成せず、文字列のまま強調する", async ({ page }) => {
  // 入力データだけを差し替え、`<b>`を文字として含む商品名を配信する。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(">黒いペン<", ">&lt;b&gt;黒いペン<") });
  });
  await page.goto("/");
  await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill("<b>");
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("rowheader")).toHaveText(["<b>黒いペン"]);
  await expect(table.getByRole("cell")).toHaveText(["PEN-001"]);
  await expectMarks(page, { names: ["<b>"], codes: [] });
  await expect(table.locator("b")).toHaveCount(0);
});

test("正規化で長さが変わる文字を含むセルは、絞り込みに含めて強調しない", async ({ page }) => {
  // U+0130はtoLowerCaseで2文字になり、後ろの一致位置が元の文字列とずれる。
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("<code>NOTE-002</code>", "<code>İNOTE-002</code>") });
  });
  await page.goto("/");
  await page.getByLabel("商品名・商品コードで検索", { exact: true }).fill("note");
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("rowheader")).toHaveText(["青いノート", "赤いノート"]);
  await expect(table.getByRole("cell")).toHaveText(["NOTE-001", "İNOTE-002"]);
  await expect(page.getByText("全4件中2件を表示", { exact: true })).toBeVisible();
  await expectMarks(page, { names: [], codes: ["NOTE"] });
});
