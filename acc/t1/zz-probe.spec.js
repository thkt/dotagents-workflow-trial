// One probe set for every PR head, written from the request and not from any run's Issue.
// A match may be wrapped as one <mark> or as several adjacent ones; both pass, so the probes
// compare the joined text where the request leaves that open.
import { expect, test } from "@playwright/test";

const LABEL = "商品名・商品コードで検索";
const PRODUCTS = [
  ["青いノート", "NOTE-001"],
  ["赤いノート", "NOTE-002"],
  ["黒いペン", "PEN-001"],
  ["白いマグ", "MUG-001"],
];

const state = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("tbody tr")).map((tr) => ({
      hidden: tr.hidden,
      name: tr.cells[0].textContent,
      code: tr.cells[1].textContent,
      th: tr.cells[0].tagName,
      codeElements: tr.cells[1].querySelectorAll("code").length,
      nameMarks: Array.from(tr.cells[0].querySelectorAll("mark")).map((m) => m.textContent),
      codeMarks: Array.from(tr.cells[1].querySelectorAll("mark")).map((m) => m.textContent),
      marksInCode: tr.cells[1].querySelectorAll("code mark").length,
      nested: tr.querySelectorAll("mark mark").length,
      foreign: tr.querySelectorAll("b, i, script, img").length,
    })),
  );

// What the page shows: per visible product, the marked text in its name and in its code.
const shown = async (page, join = "|") =>
  (await state(page))
    .filter((row) => !row.hidden)
    .map((row) => `${row.name} [${row.nameMarks.join(join)}] ${row.code} [${row.codeMarks.join(join)}]`);

const sound = async (page, products = PRODUCTS) => {
  const rows = await state(page);
  expect(rows.map((row) => [row.name, row.code]).sort(), "the text of each name and code").toEqual([...products].sort());
  for (const row of rows) {
    expect(row.th, "the name cell").toBe("TH");
    expect(row.codeElements, "the code element").toBe(1);
    expect(row.nested, "a mark inside a mark").toBe(0);
    expect(row.foreign, "an element the page did not have").toBe(0);
    if (row.hidden) expect([...row.nameMarks, ...row.codeMarks], "marks in a hidden product").toEqual([]);
  }
};

const open = async (page, replace) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  if (replace) {
    await page.route((url) => url.pathname === "/", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace(replace[0], replace[1]) });
    });
  }
  await page.goto("/");
  return { search: page.getByLabel(LABEL, { exact: true }), errors };
};

const expectShown = (page, lines, join) => expect.poll(() => shown(page, join), { timeout: 3000 }).toEqual(lines);

test("P01 a match in the name is marked and the code is not", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("ノート");
  await expectShown(page, ["青いノート [ノート] NOTE-001 []", "赤いノート [ノート] NOTE-002 []"]);
  await sound(page);
  expect(errors).toEqual([]);
});

test("P02 a lowercase query marks the uppercase characters on the page", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("note");
  await expectShown(page, ["青いノート [] NOTE-001 [NOTE]", "赤いノート [] NOTE-002 [NOTE]"]);
  await sound(page);
  expect((await state(page)).filter((row) => !row.hidden).every((row) => row.marksInCode === 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("P03 a full-width query marks the half-width characters on the page", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("ＮＯＴＥ");
  await expectShown(page, ["青いノート [] NOTE-001 [NOTE]", "赤いノート [] NOTE-002 [NOTE]"]);
  await sound(page);
  expect(errors).toEqual([]);
});

test("P04 a query with spaces around it and mixed case marks the whole code", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("  NoTe-001 ");
  await expectShown(page, ["青いノート [] NOTE-001 [NOTE-001]"]);
  await sound(page);
  expect(errors).toEqual([]);
});

for (const [name, clear] of [
  ["deleting the text", async (page, search) => {
    await search.press("ControlOrMeta+A");
    await search.press("Backspace");
  }],
  ["the clear button", async (page) => page.getByRole("button", { name: "検索をクリア", exact: true }).click()],
  ["Escape", async (page, search) => {
    await search.focus();
    await page.keyboard.press("Escape");
  }],
  ["spaces only", async (page, search) => search.fill("   ")],
  ["a reload", async (page) => page.reload()],
]) {
  test(`P05 no mark is left after ${name}`, async ({ page }) => {
    const { search, errors } = await open(page);
    await search.fill("ノート");
    await expectShown(page, ["青いノート [ノート] NOTE-001 []", "赤いノート [ノート] NOTE-002 []"]);
    await clear(page, search);
    await expectShown(page, PRODUCTS.map(([name_, code]) => `${name_} [] ${code} []`));
    await sound(page);
    expect(errors).toEqual([]);
  });
}

test("P06 a new query replaces the marks of the one before", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("ノート");
  await search.fill("青い");
  await expectShown(page, ["青いノート [青い] NOTE-001 []"]);
  await search.fill("い");
  await expectShown(page, PRODUCTS.map(([name, code]) => `${name} [い] ${code} []`));
  await sound(page);
  expect(errors).toEqual([]);
});

test("P07 typing one key at a time ends at the same marks", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.pressSequentially("note-00");
  await expectShown(page, ["青いノート [] NOTE-001 [NOTE-00]", "赤いノート [] NOTE-002 [NOTE-00]"]);
  await search.press("Backspace");
  await search.press("Backspace");
  await search.press("Backspace");
  await expectShown(page, ["青いノート [] NOTE-001 [NOTE]", "赤いノート [] NOTE-002 [NOTE]"]);
  await sound(page);
  expect(errors).toEqual([]);
});

test("P08 two matches side by side are both marked", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("0");
  await expectShown(page, PRODUCTS.map(([name, code]) => `${name} [] ${code} [00]`), "");
  await sound(page);
  expect(errors).toEqual([]);
});

test("P09 two matches apart in one name are both marked", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "白いマグ白"]);
  await search.fill("白");
  await expectShown(page, ["白いマグ白 [白|白] MUG-001 []"]);
  await sound(page, [...PRODUCTS.slice(0, 3), ["白いマグ白", "MUG-001"]]);
  expect(errors).toEqual([]);
});

test("P10 a match in both the name and the code of one product marks both", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "白いMUGマグ"]);
  await search.fill("mug");
  await expectShown(page, ["白いMUGマグ [MUG] MUG-001 [MUG]"]);
  await sound(page, [...PRODUCTS.slice(0, 3), ["白いMUGマグ", "MUG-001"]]);
  expect(errors).toEqual([]);
});

for (const query of [".", "*", "(", "[", "\\", "+", "?", "$", "^", "|", ".*", "[a-z]", "\\d"]) {
  test(`P11 the query ${JSON.stringify(query)} is read as text, not as a pattern`, async ({ page }) => {
    const { search, errors } = await open(page);
    await search.fill(query);
    await expectShown(page, []);
    await sound(page);
    expect(errors).toEqual([]);
  });
}

test("P12 a hyphen marks the hyphen of every code", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("-");
  await expectShown(page, PRODUCTS.map(([name, code]) => `${name} [] ${code} [-]`));
  await sound(page);
  expect(errors).toEqual([]);
});

for (const query of ["<b>", "&", "<mark>", "</code>", "&lt;", "amp", "mark", "code", "th"]) {
  test(`P13 the query ${JSON.stringify(query)} matches no markup`, async ({ page }) => {
    const { search, errors } = await open(page);
    await search.fill(query);
    await expectShown(page, []);
    await sound(page);
    expect(errors).toEqual([]);
  });
}

test("P14 a name holding text that looks like a tag is marked as text", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "白い&lt;b&gt;マグ"]);
  const products = [...PRODUCTS.slice(0, 3), ["白い<b>マグ", "MUG-001"]];
  await search.fill("<b>");
  await expectShown(page, ["白い<b>マグ [<b>] MUG-001 []"]);
  await sound(page, products);
  await search.fill("マグ");
  await expectShown(page, ["白い<b>マグ [マグ] MUG-001 []"]);
  await sound(page, products);
  await search.fill("b>マ");
  await expectShown(page, ["白い<b>マグ [b>マ] MUG-001 []"]);
  await sound(page, products);
  expect(errors).toEqual([]);
});

test("P15 a name holding an ampersand is matched by the character, not by its entity", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "白い&amp;マグ"]);
  const products = [...PRODUCTS.slice(0, 3), ["白い&マグ", "MUG-001"]];
  await search.fill("&");
  await expectShown(page, ["白い&マグ [&] MUG-001 []"]);
  await search.fill("amp");
  await expectShown(page, []);
  await search.fill("い&マ");
  await expectShown(page, ["白い&マグ [い&マ] MUG-001 []"]);
  await sound(page, products);
  expect(errors).toEqual([]);
});

test("P16 changing the order keeps the marks on the same products", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("ノート");
  await page.getByLabel("並び順", { exact: true }).selectOption("descending");
  await expectShown(page, ["赤いノート [ノート] NOTE-002 []", "青いノート [ノート] NOTE-001 []"]);
  await page.getByLabel("並び順", { exact: true }).selectOption("original");
  await search.fill("pen");
  await expectShown(page, ["黒いペン [] PEN-001 [PEN]"]);
  await sound(page);
  expect(errors).toEqual([]);
});

test("P17 the count, the empty message, and the row header names stay as they were", async ({ page }) => {
  const { search, errors } = await open(page);
  await search.fill("ノート");
  await expect(page.getByText("全4件中2件を表示", { exact: true })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "青いノート", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "NOTE-001", exact: true })).toBeVisible();
  await search.fill("存在しない商品");
  await expect(page.getByText("該当する商品はありません", { exact: true })).toBeVisible();
  await expectShown(page, []);
  await sound(page);
  expect(errors).toEqual([]);
});

test("P18 a name with a character outside the BMP is marked at the right place", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "😀白いマグ"]);
  await search.fill("マグ");
  await expectShown(page, ["😀白いマグ [マグ] MUG-001 []"]);
  await sound(page, [...PRODUCTS.slice(0, 3), ["😀白いマグ", "MUG-001"]]);
  expect(errors).toEqual([]);
});

// U+0130 becomes two code units when lowercased, so a position found after lowercasing no
// longer points at the same character on the page.
test("P19 a name whose lowercase form is longer is never marked at the wrong place", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "İ白いマグ"]);
  await search.fill("マグ");
  await expect.poll(async () => (await state(page)).find((row) => row.code === "MUG-001").hidden, { timeout: 3000 }).toBe(false);
  await expect.poll(() => shown(page), { timeout: 3000 }).toEqual(expect.arrayContaining([expect.stringMatching(/^İ白いマグ \[(マグ)?\] MUG-001 \[\]$/)]));
  await sound(page, [...PRODUCTS.slice(0, 3), ["İ白いマグ", "MUG-001"]]);
  expect(errors).toEqual([]);
});

test("P20 a name whose lowercase form is longer is marked at the right place", async ({ page }) => {
  const { search, errors } = await open(page, ["白いマグ", "İ白いマグ"]);
  await search.fill("マグ");
  await expectShown(page, ["İ白いマグ [マグ] MUG-001 []"]);
  expect(errors).toEqual([]);
});
