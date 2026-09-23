const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");
// 強調の対象は商品名と商品コード。強調前の文字列を保持し、検索のたびに戻してから強調し直す。
const highlightTargets = Array.from(
  document.querySelectorAll("tbody th, tbody td > code"),
  (element) => ({ element, text: element.textContent }),
);

function highlight({ element, text }, query) {
  element.textContent = text;
  if (!query) return;
  const lowerText = text.toLowerCase();
  const parts = [];
  let start = 0;
  for (let index = lowerText.indexOf(query); index !== -1; index = lowerText.indexOf(query, start)) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + query.length);
    parts.push(text.slice(start, index), mark);
    start = index + query.length;
  }
  if (parts.length > 0) element.replaceChildren(...parts, text.slice(start));
}

function updateSearch() {
  const query = search.value.trim().toLowerCase();
  let matches = 0;

  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      cell.textContent.toLowerCase().includes(query),
    );
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
  }
  for (const target of highlightTargets) highlight(target, query);

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
