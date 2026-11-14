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

function readOrder() {
  try {
    const saved = window.localStorage.getItem(orderStorageKey);
    // 選択肢にない保存値は元の順序として扱う。
    return Array.from(order.options, (option) => option.value).includes(saved) ? saved : "original";
  } catch {
    return "original";
  }
}

// 商品コードは表示文字列のUTF-16コード単位で比べ、全角・大小文字・数値の読み替えをしない。
function compareCodes(a, b) {
  const codeA = a.querySelector("code").textContent;
  const codeB = b.querySelector("code").textContent;
  if (codeA === codeB) return 0;
  return codeA < codeB ? -1 : 1;
}

const compareRows = {
  ascending: (a, b) => collator.compare(a.dataset.reading, b.dataset.reading),
  descending: (a, b) => collator.compare(b.dataset.reading, a.dataset.reading),
  "code-ascending": compareCodes,
};

function updateOrder() {
  // 元の配列から安定ソートし、同じ読み・同じコードでは元の相対順を保つ。
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
