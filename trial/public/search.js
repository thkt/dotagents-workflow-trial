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

// 正規化済みの文字列で、重ならない一致を左から順に返す。
function findMatches(text, query) {
  const ranges = [];
  let index = text.indexOf(query);
  while (index !== -1) {
    ranges.push([index, index + query.length]);
    index = text.indexOf(query, index + query.length);
  }
  return ranges;
}

// 表示中の文字列をテキストノードと<mark>で組み直し、HTMLとして解釈しない。
function highlight(element, text, ranges) {
  const parts = [];
  let end = 0;
  for (const [start, stop] of ranges) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, stop);
    parts.push(text.slice(end, start), mark);
    end = stop;
  }
  parts.push(text.slice(end));
  element.replaceChildren(...parts.filter((part) => part !== ""));
}

function updateSearch() {
  const query = normalizeSearchText(search.value.trim());
  let matches = 0;

  for (const row of rows) {
    let matchesQuery = !query;
    for (const cell of row.cells) {
      const target = cell.querySelector("code") ?? cell;
      const text = target.textContent;
      if (!query) {
        target.replaceChildren(text);
        continue;
      }
      const normalized = normalizeSearchText(text);
      const ranges = findMatches(normalized, query);
      if (ranges.length > 0) matchesQuery = true;
      // 正規化で長さが変わる文字があると一致位置を元の文字列へ写せないため、絞り込みだけに使い強調しない。
      highlight(target, text, normalized.length === text.length ? ranges : []);
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
