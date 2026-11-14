// Reference implementation of the code order for the cross-test. __MUTANT__ is replaced with "none" or with
// the name of one seeded defect. The value of the added option is read from the page, so it follows each PR.
const MUTANT = "__MUTANT__";
const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");
const order = document.getElementById("product-order");
const NAME_ORDERS = ["original", "ascending", "descending"];
const codeOrder = Array.from(order.options).map((option) => option.value).find((value) => !NAME_ORDERS.includes(value));

function normalizeSearchText(value) {
  return value.replace(/[！-～]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xFEE0),
  ).toLowerCase();
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;
  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      normalizeSearchText(cell.textContent).includes(query),
    );
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
  }
  resultCount.textContent = `全${rows.length}件中${matches}件を表示`;
  noResults.hidden = matches > 0;
  if (MUTANT === "search-resets" && order.value === codeOrder) document.querySelector("tbody").append(...rows);
}

search.addEventListener("input", updateSearch);
document.getElementById("clear-search").addEventListener("click", () => {
  search.value = "";
  updateSearch();
  if (MUTANT === "clear-resets" && order.value === codeOrder) {
    order.value = "original";
    updateOrder();
  }
});
search.value = "";
updateSearch();

const collator = new Intl.Collator("ja");
const orderStorageKey = "product-order";
const codeOf = (row) => row.cells[1].textContent;
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function readOrder() {
  const accepted = MUTANT === "no-restore" ? NAME_ORDERS : [...NAME_ORDERS, codeOrder];
  try {
    const saved = window.localStorage.getItem(orderStorageKey);
    return accepted.includes(saved) ? saved : "original";
  } catch {
    return "original";
  }
}

function byCode() {
  if (MUTANT === "no-sort") return rows;
  if (MUTANT === "numeric-compare") {
    const numeric = new Intl.Collator("en", { numeric: true });
    return rows.toSorted((a, b) => numeric.compare(codeOf(a), codeOf(b)));
  }
  if (MUTANT === "prefix-only") return rows.toSorted((a, b) => compareText(codeOf(a).split("-")[0], codeOf(b).split("-")[0]));
  if (MUTANT === "ties-reversed") return rows.toSorted((a, b) => compareText(codeOf(a), codeOf(b)) || rows.indexOf(b) - rows.indexOf(a));
  const direction = MUTANT === "code-descending" ? -1 : 1;
  return rows.toSorted((a, b) => direction * compareText(codeOf(a), codeOf(b)));
}

function updateOrder() {
  let ordered;
  if (order.value === "original") {
    ordered = MUTANT === "original-stuck" ? Array.from(document.querySelectorAll("tbody tr")) : rows;
  } else if (order.value === codeOrder) {
    ordered = byCode();
  } else {
    const direction = order.value === "descending" ? -1 : 1;
    ordered = rows.toSorted((a, b) => direction * collator.compare(a.dataset.reading, b.dataset.reading));
  }
  document.querySelector("tbody").append(...ordered);
  if (MUTANT === "unhides-rows" && order.value === codeOrder) for (const row of rows) row.hidden = false;
}

const restored = readOrder();
order.value = MUTANT === "restore-rows-only" && restored === codeOrder ? "original" : restored;
if (MUTANT === "restore-rows-only" && restored === codeOrder) document.querySelector("tbody").append(...byCode());
else if (!(MUTANT === "restore-select-only" && restored === codeOrder)) updateOrder();

order.addEventListener("change", () => {
  updateOrder();
  if (MUTANT === "no-persist" && order.value === codeOrder) return;
  const value = MUTANT === "saves-other-value" && order.value === codeOrder ? "ascending" : order.value;
  if (MUTANT === "write-throws" && order.value === codeOrder) {
    window.localStorage.setItem(orderStorageKey, value);
    return;
  }
  try {
    window.localStorage.setItem(orderStorageKey, value);
  } catch {
    // 保存できなくても、この画面の選択と検索操作は継続する。
  }
});
