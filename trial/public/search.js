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
const compareReadings = (a, b) => collator.compare(a.dataset.reading, b.dataset.reading);
const productCode = (row) => row.querySelector("code").textContent;
// 商品コードは正規化せず、UTF-16コード単位の辞書順で比較する（大文字が小文字より前）。
function compareCodes(a, b) {
  const [codeA, codeB] = [productCode(a), productCode(b)];
  if (codeA === codeB) return 0;
  return codeA < codeB ? -1 : 1;
}
const compareByOrder = {
  ascending: compareReadings,
  descending: (a, b) => compareReadings(b, a),
  "code-ascending": compareCodes,
};

function readOrder() {
  try {
    const saved = window.localStorage.getItem(orderStorageKey);
    return ["original", ...Object.keys(compareByOrder)].includes(saved) ? saved : "original";
  } catch {
    return "original";
  }
}

function updateOrder() {
  const compare = compareByOrder[order.value];
  // 並べ替えは常に配信時の行順から安定ソートし、同順位の行は元の相対順を保つ。
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
