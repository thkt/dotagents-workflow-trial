// Reference implementation of the highlight for the cross-test. The three lines below are rewritten per run:
// MUTANT names one seeded defect, MERGE wraps adjacent matches in one <mark>, FALLBACK skips the highlight
// for a text whose normalized form has another length. The rest follows PR #194.
const MUTANT = "__MUTANT__";
const MERGE = "__MERGE__" === "true";
const FALLBACK = "__FALLBACK__" === "true";

const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");

const narrow = (value) =>
  value.replace(/[！-～]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xFEE0));

function normalizeSearchText(value) {
  return narrow(value).toLowerCase();
}

const highlightTargets = rows.flatMap((row) => {
  if (MUTANT === "name-only") return [row.cells[0]];
  if (MUTANT === "code-only") return [row.querySelector("td code")];
  if (MUTANT === "td-replaced") return [row.cells[0], row.cells[1]];
  return [row.cells[0], row.querySelector("td code")];
});

function findRanges(normalized, query) {
  const ranges = [];
  let from = 0;
  for (let index = normalized.indexOf(query); index !== -1; index = normalized.indexOf(query, from)) {
    const last = ranges.at(-1);
    if (MERGE && last && last[1] === index) last[1] = index + query.length;
    else ranges.push([index, index + query.length]);
    from = index + query.length;
    if (MUTANT === "first-only") break;
  }
  return ranges;
}

function highlightMatches(element, query, typed) {
  const text = element.textContent;
  if (MUTANT === "empty-keeps" && query === "") return;
  if (MUTANT === "whitespace-keeps" && query === "" && search.value !== "") return;
  const normalized = MUTANT === "case-sensitive" ? narrow(text) : normalizeSearchText(text);
  const ranges = query === "" || (FALLBACK && normalized.length !== text.length) ? [] : findRanges(normalized, query);
  if (MUTANT === "stale" && query !== "" && ranges.length === 0) return;
  if (MUTANT === "td-replaced" && element.tagName === "TD" && !element.querySelector("mark") && ranges.length === 0) return;
  element.textContent = text;
  if (ranges.length === 0) return;

  if (MUTANT === "inner-html") {
    let html = "";
    let at = 0;
    for (const [start, end] of ranges) {
      html += `${text.slice(at, start)}<mark>${text.slice(start, end)}</mark>`;
      at = end;
    }
    element.innerHTML = html + text.slice(at);
    return;
  }
  const fragment = document.createDocumentFragment();
  let at = 0;
  for (const [start, end] of ranges) {
    const stop = MUTANT === "off-by-one" ? Math.min(end + 1, text.length) : end;
    const mark = document.createElement("mark");
    mark.textContent = MUTANT === "query-text" ? typed : text.slice(start, stop);
    fragment.append(text.slice(at, start), mark);
    at = stop;
  }
  fragment.append(text.slice(at));
  element.replaceChildren(fragment);
}

function updateSearch(keepMarks) {
  const typed = search.value.trim();
  const query = normalizeSearchText(typed);
  let matches = 0;

  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      normalizeSearchText(cell.textContent).includes(query),
    );
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
  }
  let marked = query;
  if (MUTANT === "no-trim") marked = normalizeSearchText(search.value);
  if (MUTANT === "no-fullwidth") marked = typed.toLowerCase();
  if (keepMarks !== true) for (const element of highlightTargets) highlightMatches(element, marked, typed);

  resultCount.textContent = `全${rows.length}件中${matches}件を表示`;
  noResults.hidden = matches > 0;
}

search.addEventListener("input", updateSearch);
document.getElementById("clear-search").addEventListener("click", () => {
  search.value = "";
  updateSearch(MUTANT === "clear-keeps");
});
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
  if (MUTANT === "sort-drops") {
    for (const element of highlightTargets) element.textContent = element.textContent;
  }
}

order.value = readOrder();
updateOrder();
order.addEventListener("change", () => {
  updateOrder();
  try {
    window.localStorage.setItem(orderStorageKey, order.value);
  } catch {
    // The choice still applies on this page when it cannot be saved.
  }
});
