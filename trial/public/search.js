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

// 一致位置は normalizeSearchText(text) 上で求める。正規化で文字列長が変わると
// 元の文字列の位置に対応づけられないため、その場合は強調せず元の文字列を表示する。
function highlightRanges(text, query) {
  if (query === "") return [];
  const normalized = normalizeSearchText(text);
  if (normalized.length !== text.length) return [];
  const ranges = [];
  for (let start = normalized.indexOf(query); start !== -1; start = normalized.indexOf(query, start + query.length)) {
    ranges.push([start, start + query.length]);
  }
  return ranges;
}

function renderHighlight(element, query) {
  const text = element.textContent;
  const nodes = [];
  let position = 0;
  for (const [start, end] of highlightRanges(text, query)) {
    if (start > position) nodes.push(document.createTextNode(text.slice(position, start)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, end);
    nodes.push(mark);
    position = end;
  }
  nodes.push(document.createTextNode(text.slice(position)));
  element.replaceChildren(...nodes);
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      normalizeSearchText(cell.textContent).includes(query),
    );
    row.hidden = !matchesQuery;
    renderHighlight(row.querySelector("th"), query);
    renderHighlight(row.querySelector("td code"), query);
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
