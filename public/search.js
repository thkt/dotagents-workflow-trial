const search = document.getElementById("product-search");
const rows = Array.from(document.querySelectorAll("tbody tr"));
const noResults = document.getElementById("no-results");

search.addEventListener("input", () => {
  const query = search.value.trim().toLowerCase();
  let matches = 0;

  for (const row of rows) {
    const matchesQuery = Array.from(row.cells).some((cell) =>
      cell.textContent.toLowerCase().includes(query),
    );
    row.hidden = !matchesQuery;
    if (matchesQuery) matches += 1;
  }

  noResults.hidden = matches > 0;
});
