(function () {
  function formatDeaths(val) {
    return d3.format(',.0f')(val);
  }

  function findLatestYear(rows) {
    return d3.max(rows, d => d.year);
  }

  window.renderDiseaseTreemap = function renderDiseaseTreemap(treemapSelector, trendSelector, rows) {
    if (!Array.isArray(rows) || !rows.length) return;

    // Normalize numbers
    rows.forEach(r => {
      r.deaths = +r.deaths || +r.Deaths || 0;
      r.rate = +r.rate || +r["Crude Rate"] || 0;
      r.year = +r.year || +r.Year || +r["Year Code"] || 0;
    });

    // Restrict disease trends to the 2018–2025 window used elsewhere on the page.
    const filteredRows = rows.filter(r => r.year >= 2018 && r.year <= 2025);
    if (!filteredRows.length) return;

    const latestYear = findLatestYear(filteredRows);
    const latestRows = filteredRows.filter(r => r.year === latestYear);

    const byChapter = Array.from(
      d3.group(latestRows, d => d.chapter || d["UCD - ICD Chapter"]),
      ([chapter, vals]) => ({
        chapter,
        deaths: d3.sum(vals, v => v.deaths || 0),
        rate: d3.mean(vals, v => v.rate || 0),
        year: latestYear
      })
    ).sort((a, b) => b.deaths - a.deaths);

    const container = d3.select(treemapSelector);
    container.selectAll('*').remove();

    const width = 1100;
    const height = 520;
    const svg = container.append('svg')
      .attr('width', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '100%')
      .style('height', 'auto');

    const root = d3.hierarchy({ children: byChapter }).sum(d => d.deaths);
    d3.treemap().size([width, height]).paddingInner(8)(root);

    const color = d3.scaleOrdinal().domain(byChapter.map(d => d.chapter)).range(d3.schemeTableau10.concat(d3.schemeSet3));

    let tooltip = d3.select('body').select('.disease-treemap-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('class', 'disease-treemap-tooltip')
        .style('position', 'absolute')
        .style('z-index', 2000)
        .style('background', 'rgba(15,23,42,0.92)')
        .style('color', '#e5e7eb')
        .style('padding', '10px 12px')
        .style('border-radius', '10px')
        .style('border', '1px solid rgba(148,163,184,0.4)')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('display', 'none');
    }

    function renderTrend(chapterName) {
      const trendContainer = d3.select(trendSelector);
      trendContainer.selectAll('*').remove();
      const series = filteredRows
        .filter(r => (r.chapter || r["UCD - ICD Chapter"]) === chapterName)
        .sort((a, b) => a.year - b.year);
      if (!series.length) {
        trendContainer.append('div').attr('class', 'text-muted').text('No crude-rate trend available for this chapter.');
        return;
      }

      const trendWidth = 540, trendHeight = 320, margin = { top: 28, right: 22, bottom: 38, left: 60 };
      const svgTrend = trendContainer.append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0 ${trendWidth} ${trendHeight}`)
        .style('max-width', '100%')
        .style('height', 'auto');

      const years = series.map(d => d.year);
      const x = d3.scaleLinear()
        .domain(d3.extent(years))
        .range([margin.left, trendWidth - margin.right]);
      const y = d3.scaleLinear()
        .domain([0, d3.max(series, d => d.rate) || 1])
        .nice()
        .range([trendHeight - margin.bottom, margin.top]);

      const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.rate))
        .curve(d3.curveMonotoneX);

      svgTrend.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 2.5)
        .attr('d', line);

      svgTrend.selectAll('circle')
        .data(series)
        .join('circle')
        .attr('cx', d => x(d.year))
        .attr('cy', d => y(d.rate))
        .attr('r', 4)
        .attr('fill', '#fbbf24')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1)
        .on('mouseover', function (event, d) {
          tooltip.style('display', 'block')
            .html(
              `<strong>${chapterName}</strong><br/>` +
              `Year: ${d.yearLabel || d.year}<br/>` +
              `Crude death rate: ${d3.format('.1f')(d.rate || 0)} per 100,000<br/>` +
              `Deaths in year: ${formatDeaths(d.deaths || 0)}`
            );
        })
        .on('mousemove', function (event) {
          tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 18) + 'px');
        })
        .on('mouseout', () => tooltip.style('display', 'none'));

      svgTrend.append('g')
        .attr('transform', `translate(0,${trendHeight - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(years.length).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('transform', 'rotate(0)')
        .style('text-anchor', 'middle');

      svgTrend.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.1f')))
        .append('text')
        .attr('x', -margin.left + 6)
        .attr('y', margin.top - 12)
        .attr('fill', '#e5e7eb')
        .attr('font-weight', 600)
        .text('Crude rate');

      svgTrend.selectAll('.domain, .tick line').attr('stroke', '#94a3b8');
      svgTrend.selectAll('.tick text').attr('fill', '#e5e7eb');

      svgTrend.append('text')
        .attr('x', trendWidth / 2)
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e5e7eb')
        .attr('font-size', 14)
        .attr('font-weight', 700)
        .text(`${chapterName}: Crude rate trend`);
    }

    const nodes = svg.selectAll('g.node')
      .data(root.leaves())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    nodes.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => color(d.data.chapter))
      .attr('rx', 10)
      .attr('ry', 10)
      .style('cursor', 'pointer')
      .on('click', (event, d) => renderTrend(d.data.chapter))
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 2);
        tooltip.style('display', 'block')
          .html(
            `<strong>${d.data.chapter}</strong><br/>` +
            `Latest year: ${d.data.year}<br/>` +
            `Deaths: ${formatDeaths(d.data.deaths)}<br/>` +
            `Crude death rate: ${d3.format('.1f')(d.data.rate || 0)} per 100,000<br/>` +
            `<span style="font-size:0.75rem;color:#cbd5f5;">Click to see this chapter’s trend.</span>`
          );
      })
      .on('mousemove', function (event) {
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 18) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', 'none');
        tooltip.style('display', 'none');
      });

    nodes.append('text')
      .attr('x', 10)
      .attr('y', 22)
      .attr('fill', '#0b1020')
      .attr('font-size', 16)
      .attr('font-weight', 800)
      .text(d => `${formatDeaths(d.data.deaths)}`);

  nodes.append('text')
    .attr('x', 10)
    .attr('y', 42)
    .attr('fill', '#0b1020')
    .attr('font-size', 15)
    .attr('font-weight', 600)
    .attr('dy', 4)
    .text(d => d.data.chapter);

    // Render initial trend for the largest chapter
    if (byChapter.length) {
      renderTrend(byChapter[0].chapter);
    }
  };
})();
