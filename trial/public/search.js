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

// 商品コードは td 内の code に強調を入れ、code 要素を残す。
const highlightTargets = new Map(rows.map((row) => [row, Array.from(row.cells, (cell) => {
  const element = cell.querySelector("code") ?? cell;
  const text = element.textContent;
  return { element, text, normalized: normalizeSearchText(text) };
})]));

function highlightMatches({ element, text, normalized }, query) {
  const parts = [];
  let start = 0;
  // 一致位置を表示中の文字列へ当てはめるため、正規化で長さが変わる文字列は強調しない。
  if (query && normalized.length === text.length) {
    for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
      const mark = document.createElement("mark");
      mark.textContent = text.slice(index, index + query.length);
      parts.push(text.slice(start, index), mark);
      start = index + query.length;
    }
  }
  parts.push(text.slice(start));
  // innerHTMLは使わず、記号を含む文字列もテキストのまま入れる。
  element.replaceChildren(...parts.filter((part) => part !== ""));
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    const targets = highlightTargets.get(row);
    const matchesQuery = targets.some((target) => target.normalized.includes(query));
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
    // 非表示になる行も作り直し、前の検索語の強調を残さない。
    for (const target of targets) highlightMatches(target, query);
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
