const search = document.getElementById('product-search');
const rows = Array.from(document.querySelectorAll('tbody tr'));
const resultCount = document.getElementById('result-count');
const noResults = document.getElementById('no-results');
// 強調対象は各行の商品名（th）と商品コード（td > code）。
const highlightTargets = rows.map((row) => ({
  row,
  nameCell: row.querySelector('th'),
  codeElement: row.querySelector('td code'),
}));

// 表記（大文字・小文字）を保ったまま、一致した各箇所を個別の <mark> 要素で囲んで
// element の子として描画する。検索語が空文字のときは強調しない。
// DOM API（createElement / append）で組み立て、innerHTML への文字列注入は行わない。
function renderHighlighted(element, query) {
  const text = element.textContent;
  element.replaceChildren();

  if (!query) {
    element.append(text);
    return;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let index = 0;

  while (index < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, index);
    if (matchIndex === -1) {
      element.append(text.slice(index));
      break;
    }
    if (matchIndex > index) {
      element.append(text.slice(index, matchIndex));
    }
    const mark = document.createElement('mark');
    mark.textContent = text.slice(matchIndex, matchIndex + query.length);
    element.append(mark);
    index = matchIndex + query.length;
  }
}

function updateSearch() {
  const query = search.value.trim().toLowerCase();
  let matches = 0;

  for (const { row, nameCell, codeElement } of highlightTargets) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      cell.textContent.toLowerCase().includes(query),
    );
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;

    renderHighlighted(nameCell, query);
    renderHighlighted(codeElement, query);
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
