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

// textはelementの表示文字、normalizedとqueryは正規化済み。空の検索語なら前回の<mark>を外すだけにする。
function highlightMatches({ element, text, normalized }, query) {
  element.textContent = text;
  // 位置を元の表示文字へ戻せるのは、正規化で文字数が変わらない場合だけ。
  if (!query || normalized.length !== text.length) return;

  // 検索語から要素を作らず、表示文字の切り出しをテキストと<mark>に入れる。
  const parts = [];
  let end = 0;
  for (let start = normalized.indexOf(query); start !== -1; start = normalized.indexOf(query, end)) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, start + query.length);
    parts.push(text.slice(end, start), mark);
    end = start + query.length;
  }
  if (parts.length > 0) element.replaceChildren(...parts, text.slice(end));
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    // 商品コードは<code>を残し、その内側だけを強調する。tdは<code>だけを含むので、
    // <code>の文字列で一致を判定してもセル全体の文字列と同じ結果になる。
    const targets = Array.from(row.cells, (cell) => {
      const element = cell.querySelector("code") ?? cell;
      const text = element.textContent;
      return { element, text, normalized: normalizeSearchText(text) };
    });
    const matchesQuery = targets.some(({ normalized }) => normalized.includes(query));
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
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
