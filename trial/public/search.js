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

// 商品コードは<code>の構造を保つため、その内側を強調する。
function highlightTarget(cell) {
  return cell.querySelector("code") ?? cell;
}

// 一致範囲を元の文字のまま<mark>で囲む。文字列はテキストノードとして扱い、HTMLとして解釈しない。
function highlightMatches(element, query) {
  const text = element.textContent;
  const normalized = normalizeSearchText(text);
  const nodes = [];
  let start = 0;
  // 正規化で文字数が変わるセルは一致位置を元の文字へ対応づけられないため、強調しない。
  if (query && normalized.length === text.length) {
    for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
      nodes.push(text.slice(start, index));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(index, index + query.length);
      nodes.push(mark);
      start = index + query.length;
    }
  }
  nodes.push(text.slice(start));
  element.replaceChildren(...nodes.filter((node) => node !== ""));
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
    for (const cell of row.cells) {
      highlightMatches(highlightTarget(cell), matchesQuery ? query : "");
    }
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
