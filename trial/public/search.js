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

// 一致部分を囲む対象。th直下と td > code の中に <mark> を入れ、セルの構造を保つ。
const highlightTargets = rows.flatMap((row) =>
  [row.querySelector("th"), row.querySelector("td code")].filter(Boolean),
);

function highlightMatches(element, query) {
  const text = element.textContent;
  const normalized = normalizeSearchText(text);
  // 正規化で文字数が変わる文字（例：İ）では元の文字の位置を特定できないため強調しない。
  if (!query || normalized.length !== text.length) {
    element.replaceChildren(text);
    return;
  }
  const parts = [];
  let start = 0;
  // 一致の末尾から次を探し、重ならない一致を隣り合っても別々の <mark> にする。
  for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + query.length);
    parts.push(text.slice(start, index), mark);
    start = index + query.length;
  }
  parts.push(text.slice(start));
  element.replaceChildren(...parts.filter((part) => part !== ""));
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
  for (const element of highlightTargets) highlightMatches(element, query);

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
