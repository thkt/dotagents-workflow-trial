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

// 正規化は1文字を1文字へ写すため、正規化後の一致位置を表示文字列の位置として使う。
function findMatchRanges(text, query) {
  const ranges = [];
  if (!query) return ranges;
  const normalized = normalizeSearchText(text);
  for (let start = normalized.indexOf(query); start !== -1; start = normalized.indexOf(query, start + query.length)) {
    ranges.push([start, start + query.length]);
  }
  return ranges;
}

// 検索語をHTMLとして解釈しないよう、文字列とmark要素だけで組み立てる。
function highlightCell(container, ranges) {
  const text = container.textContent;
  const parts = [];
  let position = 0;
  for (const [start, end] of ranges) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, end);
    parts.push(text.slice(position, start), mark);
    position = end;
  }
  parts.push(text.slice(position));
  container.replaceChildren(...parts);
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    // 行の表示と強調が食い違わないよう、同じ一致範囲から両方を決める。
    const cells = Array.from(row.cells, (cell) => {
      const container = cell.querySelector("code") ?? cell;
      return { container, ranges: findMatchRanges(container.textContent, query) };
    });
    const matchesQuery = !query || cells.some(({ ranges }) => ranges.length > 0);
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
    // 非表示の行はどのセルも範囲が空のため、古いmarkも外れる。
    for (const { container, ranges } of cells) highlightCell(container, ranges);
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
