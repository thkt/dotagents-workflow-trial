const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");
const highlightTargets = rows.flatMap((row) => [
  row.querySelector(":scope > th"),
  row.querySelector(":scope > td > code"),
]);

// 一致箇所をすべて元の表記のまま <mark> で囲む。空の検索語では強調を外す。
function highlight(element, query) {
  const text = element.textContent;
  const lowerText = text.toLowerCase();
  const parts = [];
  let start = 0;
  if (query) {
    for (let found = lowerText.indexOf(query); found !== -1; found = lowerText.indexOf(query, start)) {
      const mark = document.createElement("mark");
      mark.textContent = text.slice(found, found + query.length);
      parts.push(text.slice(start, found), mark);
      start = found + query.length;
    }
  }
  parts.push(text.slice(start));
  element.replaceChildren(...parts);
}

function updateSearch() {
  const query = search.value.trim().toLowerCase();
  let matches = 0;

  for (const element of highlightTargets) highlight(element, query);
  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      cell.textContent.toLowerCase().includes(query),
    );
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
