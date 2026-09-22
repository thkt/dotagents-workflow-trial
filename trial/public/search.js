const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");

// 検索語が変わるたびに非表示の行も描き直すため、各セルの元の文字列と描画先を先に控える。
// 商品コードは <code> の内側を描画先にし、<code> 自体を残す。
const cellContents = new Map(
  rows.map((row) => [
    row,
    Array.from(row.cells).map((cell) => {
      const target = cell.querySelector("code") ?? cell;
      return { target, text: target.textContent };
    }),
  ]),
);

// 検索語は利用者入力のため、innerHTMLへ連結せずDOM APIで mark と文字列を組み立てる。
function renderCell(target, text, query) {
  target.replaceChildren();
  if (query === "") {
    target.append(text);
    return;
  }
  const haystack = text.toLowerCase();
  let start = 0;
  for (let at = haystack.indexOf(query); at !== -1; at = haystack.indexOf(query, start)) {
    if (at > start) target.append(text.slice(start, at));
    const mark = document.createElement("mark");
    mark.append(text.slice(at, at + query.length));
    target.append(mark);
    start = at + query.length;
  }
  if (start < text.length) target.append(text.slice(start));
}

function updateSearch() {
  const query = search.value.trim().toLowerCase();
  let matches = 0;

  for (const row of rows) {
    const cells = cellContents.get(row);
    const matchesQuery = cells.some(({ text }) => text.toLowerCase().includes(query));
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
    for (const { target, text } of cells) renderCell(target, text, query);
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
