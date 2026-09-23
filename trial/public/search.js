const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");

function updateSearch() {
  const query = search.value.trim().toLowerCase();
  let matches = 0;

  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      cell.textContent.toLowerCase().includes(query),
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

function readOrder() {
  try {
    const saved = window.localStorage.getItem(orderStorageKey);
    return ["original", "ascending", "descending", "code-ascending"].includes(saved) ? saved : "original";
  } catch {
    return "original";
  }
}

const codeOf = (row) => row.cells[1].textContent;
const compareRows = {
  ascending: (a, b) => collator.compare(a.dataset.reading, b.dataset.reading),
  descending: (a, b) => collator.compare(b.dataset.reading, a.dataset.reading),
  // 商品コードはロケール・数値照合を使わず、文字列の既定の大小比較で並べる。
  "code-ascending": (a, b) => {
    const [codeA, codeB] = [codeOf(a), codeOf(b)];
    if (codeA === codeB) return 0;
    return codeA < codeB ? -1 : 1;
  },
};

function updateOrder() {
  const compare = compareRows[order.value];
  const ordered = compare ? rows.toSorted(compare) : rows;
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
