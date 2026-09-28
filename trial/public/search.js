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

// 強調で書き換える要素と、表示中の元の文字列・その正規化結果。商品コードは <code> の内側に <mark> を置く。
const products = rows.map((row) => ({
  row,
  fields: Array.from(row.cells, (cell) => {
    const target = cell.querySelector("code") ?? cell;
    const text = target.textContent;
    return { target, text, normalized: normalizeSearchText(text) };
  }),
}));

// 一致した元の文字を <mark> で囲み、要素の子を組み直す。文字列はHTMLとして解釈しない。
function highlightMatches({ target, text, normalized }, query) {
  const nodes = [];
  let end = 0;
  // 空の検索語は一致位置が進まないため、強調しない。
  for (let start = query ? normalized.indexOf(query) : -1; start !== -1; start = normalized.indexOf(query, end)) {
    const mark = document.createElement("mark");
    // 正規化は1文字対1文字のため、正規化後の位置で元の文字を切り出せる。
    mark.textContent = text.slice(start, start + query.length);
    nodes.push(document.createTextNode(text.slice(end, start)), mark);
    end = start + query.length;
  }
  nodes.push(document.createTextNode(text.slice(end)));
  target.replaceChildren(...nodes);
  // 空の検索語は全件を表示する。それ以外は1個以上囲んだとき（end > 0）に一致とする。
  return query === "" || end > 0;
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const { row, fields } of products) {
    // 非表示になる行も組み直し、前の検索語の <mark> を残さない。
    const matchesQuery = fields.map((field) => highlightMatches(field, query)).includes(true);
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
