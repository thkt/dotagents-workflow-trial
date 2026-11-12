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

// 表示文字列を変えずに、重ならない一致をすべて<mark>で囲み、一致の個数を返す。検索語は文字列として比較し、HTMLとして挿入しない。
function highlightMatches(target, query) {
  const text = target.textContent;
  // normalizeSearchTextは1文字を1文字へ変換するため、変換後の一致位置で表示文字列を切り出せる。
  const normalized = normalizeSearchText(text);
  const parts = [];
  let count = 0;
  let start = 0;
  let index = query ? normalized.indexOf(query) : -1;
  while (index !== -1) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + query.length);
    parts.push(text.slice(start, index), mark);
    count += 1;
    start = index + query.length;
    index = normalized.indexOf(query, start);
  }
  parts.push(text.slice(start));
  target.replaceChildren(...parts);
  return count;
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    // 絞り込みと強調は同じ照合結果を使う。強調を全セルで行うため、一致したセルで打ち切らない。
    // 商品コードは<code>の内側を強調し、表構造を保つ。
    let matchCount = 0;
    for (const cell of row.cells) matchCount += highlightMatches(cell.querySelector("code") ?? cell, query);
    const matchesQuery = !query || matchCount > 0;
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
    return ["original", "ascending", "descending"].includes(saved) ? saved : "original";
  } catch {
    return "original";
  }
}

function updateOrder() {
  const direction = order.value === "descending" ? -1 : 1;
  const ordered = order.value === "original" ? rows : rows.toSorted((a, b) =>
    direction * collator.compare(a.dataset.reading, b.dataset.reading),
  );
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
