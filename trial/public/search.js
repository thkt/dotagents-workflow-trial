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

// 前回の <mark> を外し、正規化後の一致位置にある元の文字を1件ずつ <mark> で囲む。
// 検索語はHTMLとして解釈せず、表示文字列（textContent）は変えない。
function highlightMatches({ target, text, normalized }, query) {
  const parts = [];
  // 正規化で文字数が変わる入力（例：İ）は位置が対応しないため強調しない。
  if (query && normalized.length === text.length) {
    let start = 0;
    for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
      parts.push(text.slice(start, index));
      start = index + query.length;
      const mark = document.createElement("mark");
      mark.textContent = text.slice(index, start);
      parts.push(mark);
    }
    parts.push(text.slice(start));
  } else {
    parts.push(text);
  }
  target.replaceChildren(...parts.filter((part) => part !== ""));
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    // 商品コードは <code> の内側に <mark> を入れ、セルの構造を保つ。
    // 一致の判定と強調の位置は、同じ正規化済みの文字列から求める。
    const cells = Array.from(row.cells, (cell) => {
      const target = cell.querySelector("code") ?? cell;
      const text = target.textContent;
      return { target, text, normalized: normalizeSearchText(text) };
    });
    const matchesQuery = cells.some(({ normalized }) => normalized.includes(query));
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
    for (const cell of cells) {
      highlightMatches(cell, matchesQuery ? query : "");
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
