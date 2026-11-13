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

// 強調する商品名・商品コードの要素。tdを書き換えるとcode要素が消えるため、codeの中だけを対象にする。
const highlightTargets = rows.flatMap((row) => [row.cells[0], row.querySelector("td code")]);

function highlightMatches(element, query) {
  // 前回の<mark>を外し、表示文字列だけに戻す。
  const text = element.textContent;
  element.textContent = text;
  if (query === "") return;

  // 正規化は1文字を1文字へ変換するため、正規化後の一致位置で元の表示文字を切り出せる。
  const normalized = normalizeSearchText(text);
  const fragment = document.createDocumentFragment();
  let start = 0;
  for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, start)) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + query.length);
    fragment.append(text.slice(start, index), mark);
    start = index + query.length;
  }
  if (start === 0) return;
  fragment.append(text.slice(start));
  element.replaceChildren(fragment);
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
