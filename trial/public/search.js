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

// 正規化は1文字を1文字に変換するため、正規化後の一致位置を表示中の元の文字に使う。
// 検索語はHTMLとして挿入せず、テキストノードと<mark>要素で組み立てる。
function highlightMatches(element, query) {
  const text = element.textContent;
  const normalized = normalizeSearchText(text);
  const parts = [];
  let start = 0;
  // 空の検索語では強調しない（indexOf("")は常に一致する）。
  for (let index = query ? normalized.indexOf(query) : -1; index !== -1; index = normalized.indexOf(query, start)) {
    if (index > start) parts.push(text.slice(start, index));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + query.length);
    parts.push(mark);
    start = index + query.length;
  }
  if (start < text.length) parts.push(text.slice(start));
  element.replaceChildren(...parts);
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
    // 非表示の行も組み直し、前の検索語の<mark>を残さない。
    highlightMatches(row.querySelector("th"), query);
    highlightMatches(row.querySelector("td > code"), query);
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
