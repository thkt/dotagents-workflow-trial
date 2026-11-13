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

// 全角ASCIIの変換と、現在の商品名・コードの小文字化は1文字を1文字へ置き換える。
// そのため、正規化後の一致位置で元の表示文字を切り出せる。
// 検索語はHTMLとして解釈せず、<mark>と文字列ノードだけで組み立てる。
// 作った<mark>の数を返し、行の表示判定にも使う。
function highlightMatches(element, query) {
  const text = element.textContent;
  const parts = [];
  let start = 0;
  let markCount = 0;
  if (query) {
    const normalized = normalizeSearchText(text);
    for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
      const mark = document.createElement("mark");
      mark.textContent = text.slice(index, index + query.length);
      parts.push(text.slice(start, index), mark);
      start = index + query.length;
      markCount += 1;
    }
  }
  parts.push(text.slice(start));
  element.replaceChildren(...parts.filter((part) => part !== ""));
  return markCount;
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    // 非表示になる行も作り直し、前の検索語の強調を残さない。
    // 商品コードは<code>の内側を強調し、<code>要素を残す。
    let markCount = 0;
    for (const cell of row.cells) markCount += highlightMatches(cell.querySelector("code") ?? cell, query);
    const matchesQuery = !query || markCount > 0;
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
