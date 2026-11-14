// Probes for T2 (code order), written from the request and not from any implementation.
// P: the committed four products. D: other product rows served in place of the committed ones.
import { expect, test } from "@playwright/test";

const storageKey = "product-order";
const original = [
  ["青いノート", "NOTE-001"],
  ["赤いノート", "NOTE-002"],
  ["黒いペン", "PEN-001"],
  ["白いマグ", "MUG-001"],
];
const byCode = [original[3], original[0], original[1], original[2]];
const nameDescending = [original[3], original[2], original[1], original[0]];
const NAME_ORDERS = ["original", "ascending", "descending"];
const order = (page) => page.getByLabel("並び順", { exact: true });
const search = (page) => page.getByLabel("商品名・商品コードで検索", { exact: true });
const saved = (page) => page.evaluate((key) => localStorage.getItem(key), storageKey);

const options = (page) =>
  order(page).locator("option").evaluateAll((all) => all.map((o) => ({ value: o.value, label: o.textContent.trim() })));
// The value of the added option is the implementation's choice, so the probes read it from the page.
const codeValue = async (page) => {
  const added = (await options(page)).filter((o) => !["original", "ascending", "descending"].includes(o.value));
  expect(added.length, "options beyond the three existing ones").toBe(1);
  return added[0].value;
};
const shown = (page) =>
  page.locator("tbody tr").evaluateAll((rows) =>
    rows.filter((row) => !row.hidden).map((row) => [row.cells[0].textContent.trim(), row.cells[1].textContent.trim()]),
  );
const expectRows = (page, products) => expect.poll(() => shown(page)).toEqual(products);
const codes = async (page) => (await shown(page)).map(([, code]) => code);
const expectCodes = (page, expected) => expect.poll(() => codes(page)).toEqual(expected);

// Serves the page with other product rows, in the markup the committed rows use.
const withRows = (page, products) =>
  page.route((url) => url.pathname === "/", async (route) => {
    const response = await route.fetch();
    const rows = products
      .map(([name, code], i) => `<tr data-reading="よみ${String(i).padStart(2, "0")}"><th scope="row">${name}</th><td><code>${code}</code></td></tr>`)
      .join("");
    const body = (await response.text()).replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${rows}</tbody>`);
    await route.fulfill({ response, body });
  });
const sortInjected = async (page, products) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await withRows(page, products);
  await page.goto("/");
  await order(page).selectOption(await codeValue(page));
  return errors;
};

test("P01 the three existing options keep their values and labels, and one option naming the code order is added", async ({ page }) => {
  await page.goto("/");
  const all = await options(page);
  expect(all.filter((o) => NAME_ORDERS.includes(o.value))).toEqual([
    { value: "original", label: "元の順序" },
    { value: "ascending", label: "商品名：昇順" },
    { value: "descending", label: "商品名：降順" },
  ]);
  expect(all.length).toBe(4);
  const added = all.find((o) => !NAME_ORDERS.includes(o.value));
  expect(added.label).toContain("商品コード");
  expect(added.label).toContain("昇順");
});

test("P02 choosing the code order lists MUG-001, NOTE-001, NOTE-002, PEN-001", async ({ page }) => {
  await page.goto("/");
  const value = await codeValue(page);
  await order(page).selectOption(value);
  await expect(order(page)).toHaveValue(value);
  await expectRows(page, byCode);
  await expect(page.getByText("全4件中4件を表示", { exact: true })).toBeVisible();
});

test("P03 the choice is saved at once under the existing key", async ({ page }) => {
  await page.goto("/");
  expect(await saved(page)).toBeNull();
  const value = await codeValue(page);
  await order(page).selectOption(value);
  expect(await saved(page)).toBe(value);
});

test("P04 a reload restores the code order in the select and in the rows, with an empty search", async ({ page }) => {
  await page.goto("/");
  const value = await codeValue(page);
  await order(page).selectOption(value);
  await search(page).fill("ノート");
  await page.reload();
  await expect(order(page)).toHaveValue(value);
  await expect(search(page)).toHaveValue("");
  await expectRows(page, byCode);
});

for (const [to, products] of [["original", original], ["ascending", original], ["descending", nameDescending]]) {
  test(`P05 after the code order, ${to} gives its own order and is the saved value`, async ({ page }) => {
    await page.goto("/");
    await order(page).selectOption(await codeValue(page));
    await expectRows(page, byCode);
    await order(page).selectOption(to);
    await expectRows(page, products);
    expect(await saved(page)).toBe(to);
    await page.reload();
    await expect(order(page)).toHaveValue(to);
    await expectRows(page, products);
  });
}

test("P06 a search under the code order shows the matching rows in code order", async ({ page }) => {
  await page.goto("/");
  await order(page).selectOption(await codeValue(page));
  await search(page).fill("ノート");
  await expectRows(page, [original[0], original[1]]);
  await expect(page.getByText("全4件中2件を表示", { exact: true })).toBeVisible();
  await search(page).fill("00");
  await expectRows(page, byCode);
});

test("P07 a search with no match under the code order shows the message, and clearing returns all rows in code order", async ({ page }) => {
  await page.goto("/");
  const value = await codeValue(page);
  await order(page).selectOption(value);
  await search(page).fill("見つからない");
  await expectRows(page, []);
  await expect(page.getByText("該当する商品はありません", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
  await expectRows(page, byCode);
  await expect(order(page)).toHaveValue(value);
  expect(await saved(page)).toBe(value);
});

test("P08 choosing the code order while a search is active keeps the search, and the later rows come in code order", async ({ page }) => {
  await page.goto("/");
  await search(page).fill("0");
  await order(page).selectOption("descending");
  await expectRows(page, nameDescending);
  await order(page).selectOption(await codeValue(page));
  await expect(search(page)).toHaveValue("0");
  await expectRows(page, byCode);
  await search(page).fill("pen");
  await expectRows(page, [original[2]]);
  await search(page).press("ControlOrMeta+A");
  await search(page).press("Backspace");
  await expectRows(page, byCode);
});

test("P09 the saved value of the code order with spaces around it starts in the original order", async ({ page }) => {
  await page.goto("/");
  const value = await codeValue(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, ` ${value} `), { key: storageKey, value });
  await page.reload();
  await expect(order(page)).toHaveValue("original");
  await expectRows(page, original);
});

test("P10 an unsupported saved value still starts in the original order", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem(key, "unsupported"), storageKey);
  await page.reload();
  await expect(order(page)).toHaveValue("original");
  await expectRows(page, original);
});

test("P11 when saving fails, the code order still applies with no page error, and the next load uses the last saved value", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await order(page).selectOption("descending");
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  });
  await page.reload();
  await order(page).selectOption(await codeValue(page));
  await expectRows(page, byCode);
  await search(page).fill("note");
  await expectRows(page, [original[0], original[1]]);
  expect(errors).toEqual([]);
  const healthy = await context.newPage();
  await healthy.goto("/");
  await expect(order(healthy)).toHaveValue("descending");
});

for (const failure of ["read", "access"]) {
  test(`P12 when storage ${failure} fails, the page starts in the original order and the code order can still be chosen`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const value = await codeValue(page);
    await order(page).selectOption(value);
    await page.addInitScript((failure) => {
      if (failure === "access") {
        Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
      } else {
        Storage.prototype.getItem = () => { throw new DOMException("denied", "SecurityError"); };
      }
    }, failure);
    await page.reload();
    await expect(order(page)).toHaveValue("original");
    await expectRows(page, original);
    await order(page).selectOption(value);
    await expectRows(page, byCode);
    expect(errors).toEqual([]);
  });
}

test("P13 another tab does not change at once and takes the code order on its next load", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(() => {
    window.nextStorageEvent = new Promise((resolve) => window.addEventListener("storage", () => resolve(), { once: true }));
  });
  const value = await codeValue(page);
  await order(page).selectOption(value);
  await other.evaluate(() => window.nextStorageEvent);
  await expect(order(other)).toHaveValue("original");
  await expectRows(other, original);
  await other.reload();
  await expect(order(other)).toHaveValue(value);
  await expectRows(other, byCode);
});

test("P14 choosing the code order causes no navigation and keeps the focus on the select", async ({ page }) => {
  await page.goto("/");
  let navigations = 0;
  page.on("framenavigated", () => { navigations += 1; });
  await order(page).focus();
  await order(page).selectOption(await codeValue(page));
  await expect(order(page)).toBeFocused();
  expect(navigations).toBe(0);
});

test("P15 with nothing saved the page still starts in the original order and saves nothing", async ({ page }) => {
  await page.goto("/");
  await expect(order(page)).toHaveValue("original");
  await expectRows(page, original);
  expect(await saved(page)).toBeNull();
});

test("P16 the saved name order still restores", async ({ page }) => {
  await page.goto("/");
  await order(page).selectOption("descending");
  await page.reload();
  await expect(order(page)).toHaveValue("descending");
  await expectRows(page, nameDescending);
});

test("D01 codes compare as strings: A-10 comes before A-2", async ({ page }) => {
  const errors = await sortInjected(page, [["二", "A-2"], ["十", "A-10"], ["一", "A-1"]]);
  await expectCodes(page, ["A-1", "A-10", "A-2"]);
  expect(errors).toEqual([]);
});

test("D02 rows with the same code keep their relative order", async ({ page }) => {
  const errors = await sortInjected(page, [["x1", "B-1"], ["x2", "A-1"], ["x3", "B-1"], ["x4", "A-1"], ["x5", "B-1"]]);
  await expectRows(page, [["x2", "A-1"], ["x4", "A-1"], ["x1", "B-1"], ["x3", "B-1"], ["x5", "B-1"]]);
  expect(errors).toEqual([]);
});

test("D03 a code that is a prefix of another comes first", async ({ page }) => {
  const errors = await sortInjected(page, [["x1", "AB"], ["x2", "ABC"], ["x3", "A"]]);
  await expectCodes(page, ["A", "AB", "ABC"]);
  expect(errors).toEqual([]);
});

test("D04 codes that differ after the hyphen are ordered by the whole code", async ({ page }) => {
  const errors = await sortInjected(page, [["x1", "NOTE-003"], ["x2", "NOTE-001"], ["x3", "MUG-002"], ["x4", "NOTE-002"]]);
  await expectCodes(page, ["MUG-002", "NOTE-001", "NOTE-002", "NOTE-003"]);
  expect(errors).toEqual([]);
});

const mixedCase = [["x1", "b-1"], ["x2", "A-1"], ["x3", "a-1"], ["x4", "B-1"]];
test("D05a mixed case codes come in code unit order", async ({ page }) => {
  await sortInjected(page, mixedCase);
  await expectCodes(page, ["A-1", "B-1", "a-1", "b-1"]);
});
test("D05b mixed case codes come in locale order", async ({ page }) => {
  await sortInjected(page, mixedCase);
  await expectCodes(page, ["a-1", "A-1", "b-1", "B-1"]);
});

const fullWidth = [["x1", "C-1"], ["x2", "Ｂ-1"], ["x3", "A-1"]];
test("D06a a full width letter comes in code unit order", async ({ page }) => {
  await sortInjected(page, fullWidth);
  await expectCodes(page, ["A-1", "C-1", "Ｂ-1"]);
});
test("D06b a full width letter comes in locale order", async ({ page }) => {
  await sortInjected(page, fullWidth);
  await expectCodes(page, ["A-1", "Ｂ-1", "C-1"]);
});

test("D07 a row with an empty code is listed first, with no page error", async ({ page }) => {
  const errors = await sortInjected(page, [["x1", "B-1"], ["x2", ""], ["x3", "A-1"]]);
  await expectCodes(page, ["", "A-1", "B-1"]);
  expect(errors).toEqual([]);
});

test("D08 an empty list sorts with no page error", async ({ page }) => {
  const errors = await sortInjected(page, []);
  await expectRows(page, []);
  await expect(page.getByText("全0件中0件を表示", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("D09 a search under the code order keeps equal codes in their relative order", async ({ page }) => {
  await sortInjected(page, [["x1 紙", "B-1"], ["x2 紙", "A-1"], ["x3 布", "B-1"], ["x4 紙", "A-1"], ["x5 紙", "B-1"]]);
  await search(page).fill("紙");
  await expectRows(page, [["x2 紙", "A-1"], ["x4 紙", "A-1"], ["x1 紙", "B-1"], ["x5 紙", "B-1"]]);
});

test("D10 after a reload the restored code order sorts the rows served then", async ({ page }) => {
  await sortInjected(page, [["二", "A-2"], ["十", "A-10"], ["一", "A-1"]]);
  await page.reload();
  await expectCodes(page, ["A-1", "A-10", "A-2"]);
});

test("P17 choosing the code order while a search hides rows keeps them hidden", async ({ page }) => {
  await page.goto("/");
  await search(page).fill("ノート");
  await expectRows(page, [original[0], original[1]]);
  await order(page).selectOption(await codeValue(page));
  await expectRows(page, [original[0], original[1]]);
  await expect(page.getByText("全4件中2件を表示", { exact: true })).toBeVisible();
});
