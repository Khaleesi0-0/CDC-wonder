CDC WONDER Mortality Explorer
============================

Interactive visualizations for U.S. provisional mortality patterns (2018–2025) built from CDC WONDER exports. Open the HTML directly or via a simple local server; all data is pulled from the `Data/` folder or the published raw GitHub URLs.

Quick start
-----------
- Main page: open `Code/Website/home.html` in a browser.
- Optional context: `Code/Website/design.html` documents the layout and design rationale.

What’s inside
-------------
- `Code/Website/js/`: D3/Plotly visualizations (choropleth, treemap, sunburst, stacked trends) and the data loader that fetches CSV/TopoJSON assets.
- `Data/`: CDC WONDER-derived CSVs (state totals, trends, top causes, urbanization, age/place-of-death) used by the visualizations.
- `MortalitybyRace.csv`: larger race/sex/cause export used in the map and totals.

Notes
-----
- Data files include provisional 2025 pulls; crude rates are computed client-side when not present in the CSVs.
- If remote fetches fail, verify connectivity to GitHub raw links referenced in `Code/Website/js/data-loader.js`.
