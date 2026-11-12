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

// 検索語に一致した部分を、表示中の文字列のまま重ならない範囲ごとに<mark>で囲み、一致があったかを返す。
// 空の検索語は全行を表示するため、一致ありとして返す。
// normalizeSearchTextは1文字を1文字へ変換するため、変換後の一致位置を表示文字列の位置に使う。
function highlightMatches(element, query) {
  const text = element.textContent;
  if (!query) {
    // 以前の<mark>を取り除く。空の検索語はindexOfが進まないため、ここで終える。
    element.textContent = text;
    return true;
  }

  const normalized = normalizeSearchText(text);
  const parts = [];
  let start = 0;
  for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + query.length);
    parts.push(text.slice(start, index), mark);
    start = index + query.length;
  }
  parts.push(text.slice(start));
  element.replaceChildren(...parts.filter((part) => part !== ""));
  return start > 0;
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    let matchesQuery = false;
    for (const cell of row.cells) {
      // 商品コードの<mark>は<code>の内側に置き、表構造を保つ。前の検索語の<mark>を消すため、全セルを走査する。
      if (highlightMatches(cell.querySelector("code") ?? cell, query)) matchesQuery = true;
    }
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
