const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");

function normalizeSearchText(value) {
  // ASCIIの幅だけを揃え、かなや範囲外の記号は変換しない。
  return value.replace(/[\uFF01-\uFF5E]/g, (character) =>
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
}

search.addEventListener("input", updateSearch);
document.getElementById("clear-search").addEventListener("click", () => {
  search.value = "";
  updateSearch();
});
// 検索語は保存せず、ブラウザーのフォーム復元があっても空で開始する。
search.value = "";
updateSearch();

const order = document.getElementById("product-order");
const collator = new Intl.Collator("ja");
const orderStorageKey = "product-order";

function compareCodeUnits(a, b) {
  // UTF-16のコード単位で比べる。大小文字を区別し、空白・全角を変換せず、数字を数値として扱わない。
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

const productCode = (row) => row.cells[1].textContent;
// 元の順序以外の並び順。比較結果が同じ行は、toSortedによりHTMLの並びを保つ。
const compareRowsByOrder = {
  ascending: (a, b) => collator.compare(a.dataset.reading, b.dataset.reading),
  descending: (a, b) => collator.compare(b.dataset.reading, a.dataset.reading),
  "code-ascending": (a, b) => compareCodeUnits(productCode(a), productCode(b)),
};

function readOrder() {
  try {
    const saved = window.localStorage.getItem(orderStorageKey);
    return Object.hasOwn(compareRowsByOrder, saved) ? saved : "original";
  } catch {
    return "original";
  }
}

function updateOrder() {
  const compareRows = compareRowsByOrder[order.value];
  const ordered = compareRows ? rows.toSorted(compareRows) : rows;
  document.querySelector("tbody").append(...ordered);
}

order.value = readOrder();
updateOrder();
order.addEventListener("change", () => {
  updateOrder();
  try {
    window.localStorage.setItem(orderStorageKey, order.value);
  } catch {
    // 保存できなくても、この画面の選択と検索操作は継続する。
  }
});
