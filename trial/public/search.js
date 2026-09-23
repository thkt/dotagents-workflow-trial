const search = document.getElementById('product-search');
const rows = Array.from(document.querySelectorAll('tbody tr'));
const resultCount = document.getElementById('result-count');
const noResults = document.getElementById('no-results');

// 行ごとに強調対象セルと元の文字列を保持する。並び替え後もDOM要素自体は
// 使い回されるため、読み込み時に一度だけ記録すれば、入力のたびに
// セルを検索し直さずに済む。現在のDOMから組み立て直すと、前回強調した
// <mark>が入れ子になってしまう。
const highlightCells = new Map();
const originalText = new WeakMap();
for (const row of rows) {
  const cells = [row.querySelector('th[scope="row"]'), row.querySelector('td code')].filter(
    Boolean,
  );
  highlightCells.set(row, cells);
  for (const cell of cells) originalText.set(cell, cell.textContent);
}

function highlightElement(element, query) {
  const text = originalText.get(element);
  if (text === undefined) return;
  element.textContent = '';
  if (query === '') {
    element.append(document.createTextNode(text));
    return;
  }
  const lowerText = text.toLowerCase();
  // toLowerCase()で文字数が変わる文字（例: İ）を含む場合は、小文字化した
  // 位置で元の文字列を切ると境界がずれるため、強調せず元の文字列のまま表示する。
  if (lowerText.length !== text.length) {
    element.append(document.createTextNode(text));
    return;
  }
  let cursor = 0;
  let matchIndex = lowerText.indexOf(query, cursor);
  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      element.append(document.createTextNode(text.slice(cursor, matchIndex)));
    }
    const mark = document.createElement('mark');
    mark.textContent = text.slice(matchIndex, matchIndex + query.length);
    element.append(mark);
    cursor = matchIndex + query.length;
    matchIndex = lowerText.indexOf(query, cursor);
  }
  if (cursor < text.length) {
    element.append(document.createTextNode(text.slice(cursor)));
  }
}

function highlightRow(row, query) {
  for (const cell of highlightCells.get(row) ?? []) {
    highlightElement(cell, query);
  }
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
    highlightRow(row, query);
  }

  resultCount.textContent = `全${rows.length}件中${matches}件を表示`;
  noResults.hidden = matches > 0;
}

search.addEventListener('input', updateSearch);
document.getElementById('clear-search').addEventListener('click', () => {
  search.value = '';
  updateSearch();
});
// 検索語は保存せず、ブラウザーのフォーム復元があっても空で開始する。
search.value = '';
updateSearch();

const order = document.getElementById('product-order');
const collator = new Intl.Collator('ja');
const orderStorageKey = 'product-order';

function readOrder() {
  try {
    const saved = window.localStorage.getItem(orderStorageKey);
    return ['original', 'ascending', 'descending'].includes(saved) ? saved : 'original';
  } catch {
    return 'original';
  }
}

function updateOrder() {
  const direction = order.value === 'descending' ? -1 : 1;
  const ordered =
    order.value === 'original'
      ? rows
      : rows.toSorted((a, b) => direction * collator.compare(a.dataset.reading, b.dataset.reading));
  document.querySelector('tbody').append(...ordered);
}

order.value = readOrder();
updateOrder();
order.addEventListener('change', () => {
  updateOrder();
  try {
    window.localStorage.setItem(orderStorageKey, order.value);
  } catch {
    // 保存できなくても、この画面の選択と検索操作は継続する。
  }
});
