const search = document.getElementById('product-search');
const rows = Array.from(document.querySelectorAll('tbody tr'));
const resultCount = document.getElementById('result-count');
const noResults = document.getElementById('no-results');

// containerの子を、queryに一致した部分だけmarkで囲んだテキストに作り直す。
// textContentの合計は変えず、一致がなければ元のテキストへ戻す。
function highlightMatch(container, query) {
  const text = container.textContent;
  const index = query === '' ? -1 : text.toLowerCase().indexOf(query);
  container.replaceChildren();
  if (index === -1) {
    container.append(text);
    return;
  }
  if (index > 0) container.append(text.slice(0, index));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(index, index + query.length);
  container.append(mark);
  const rest = text.slice(index + query.length);
  if (rest) container.append(rest);
}

// 商品名（th）と商品コード（td内のcode）それぞれに一致部分の強調を反映する。
function highlightRow(row, query) {
  const nameCell = row.querySelector('th');
  highlightMatch(nameCell, query);
  const codeElement = row.querySelector('td code');
  if (codeElement) highlightMatch(codeElement, query);
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
