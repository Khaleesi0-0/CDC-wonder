// urban-trends.js
// Creates the stacked area "trends" visualization powered by the Urban dataset.
(function () {
  const localPath = '../../Data/Urban.csv';
   const remotePath = 'https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/Urban.csv';

  async function loadUrbanCsv() {
    async function tryLoad(path) {
      const rows = await d3.csv(path);
      if (!rows || !rows.length) throw new Error('Empty CSV');
      return rows;
    }
    try {
      return await tryLoad(localPath);
    } catch (err) {
      console.warn(`Urban trends: local load failed (${err.message}). Trying remote.`);
      return await tryLoad(remotePath);
    }
  }

  const fieldConfigs = [
    { id: 'gender', field: 'Sex', label: 'Gender', button: '#gender-button' },
    { id: 'place', field: 'Residence 2013 Urbanization', label: 'Place', button: '#place-button' },
    { id: 'ethnicity', field: 'Single Race 6', label: 'Ethnicity', button: '#ethnicity-button' },
    { id: 'cause', field: 'UCD - ICD Chapter', label: 'Cause Chapter', button: '#cause-button' },
    { id: 'total', field: null, label: 'Total', button: '#total-button' }
  ];

  function normalizeRows(rows) {
    return rows.map(r => {
      const rawYear = (r.Year || '').toString();
      const numericYear = rawYear.replace(/[^\d]/g, '');
      const yearValue = numericYear ? +numericYear : +r['Year Code'] || null;
      return {
        year: yearValue,
        deaths: +r.Deaths || 0,
        sex: r.Sex || '(missing)',
        race: r['Single Race 6'] || '(missing)',
        place: r['Residence 2013 Urbanization'] || '(missing)',
        cause: r['UCD - ICD Chapter'] || '(missing)'
      };
    }).filter(r => r.year && r.deaths > 0);
  }

  function buildStackData(rows, field, maxSegments = 6) {
    const years = Array.from(new Set(rows.map(r => r.year))).sort((a, b) => a - b);
    const totalByKey = new Map();
    const fieldAccessor = field
      ? r => {
        if (field === 'Sex') return r.sex;
        if (field === 'Residence 2013 Urbanization') return r.place;
        if (field === 'Single Race 6') return r.race;
        if (field === 'UCD - ICD Chapter') return r.cause;
        return r[field] || '(missing)';
      }
      : () => 'Total';

    rows.forEach(r => {
      const key = field ? (fieldAccessor(r) || '(missing)') : 'Total';
      totalByKey.set(key, (totalByKey.get(key) || 0) + r.deaths);
    });

    let keys;
    if (!field) {
      keys = ['Total'];
    } else {
      const ordered = Array.from(totalByKey.entries()).sort((a, b) => b[1] - a[1]);
      keys = ordered.slice(0, maxSegments).map(([key]) => key);
      keys.push('Other');
    }

    const data = years.map(year => {
      const rowsInYear = rows.filter(r => r.year === year);
      const sums = d3.rollup(rowsInYear, v => d3.sum(v, d => d.deaths), r => field ? fieldAccessor(r) || '(missing)' : 'Total');
      const entry = { year };
      let otherTotal = 0;
      keys.forEach(key => {
        if (key === 'Other') return;
        entry[key] = sums.get(key) || 0;
      });
      if (field) {
        sums.forEach((value, key) => {
          if (!keys.includes(key)) otherTotal += value;
        });
        entry.Other = otherTotal;
      }
      entry.total = d3.sum(keys, key => entry[key] || 0);
      return entry;
    });
    return { data, keys };
  }

  function formatNumber(value) {
    return d3.format(',')(value);
  }

  function formatPercent(value) {
    return d3.format('.1%')(value);
  }

  window.renderUrbanTrends = async function renderUrbanTrends(containerSelector = '#trends-container', preloadedRows = null) {
    const rowsRaw = preloadedRows && preloadedRows.length ? preloadedRows : await loadUrbanCsv();
    const rows = normalizeRows(rowsRaw);
    if (!rows.length) throw new Error('Urban dataset empty for trends module');

    const container = d3.select(containerSelector);
    if (container.empty()) return;

    const svg = container.select('.stack-chart-svg');
    if (svg.empty()) return;
    const width = 820;
    const height = 420;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();
    const margin = { top: 10, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().range([0, innerWidth]);
    const yScale = d3.scaleLinear().range([innerHeight, 0]);
    const colorScale = d3.scaleOrdinal([
      '#4477AA', '#66CCEE', '#228833', '#CCBB44', '#EE6677',
      '#AA3377', '#882255', '#44AA99', '#117733', '#999933'
    ]);

    const chartContent = container.select('#stack-chart-content');
    const chartContentNode = chartContent.empty() ? container.node() : chartContent.node();
    const legend = container.select('#stack-legend .legend-items');
    const chartContentNode = container.select('#stack-chart-content').node();
    const insightHeader = container.select('#trends-insights-header');
    const insightText = container.select('#trends-text');
    const nextBtn = container.select('#trends-next');
    const tooltip = chartContent.selectAll('.stack-tooltip').data([null]).join('div').attr('class', 'stack-tooltip');

    let insightMessages = [];
    let insightIndex = 0;

    function updateLegend(keys) {
      const items = legend.selectAll('.legend-item').data(keys, d => d);
      const enter = items.enter().append('div').attr('class', 'legend-item');
      enter.append('span').attr('class', 'legend-swatch');
      enter.append('span').attr('class', 'legend-label');
      const merged = enter.merge(items);
      merged.select('.legend-swatch').style('background', d => colorScale(d));
      merged.select('.legend-label').text(d => d);
      items.exit().remove();
    }

    function buildInsights(def, stackData, keys) {
      if (!stackData.length) return [];
      const latest = stackData[stackData.length - 1];
      const earliest = stackData[0];
      const totalsLatest = keys.map(key => ({ key, value: latest[key] || 0 }));
      totalsLatest.sort((a, b) => b.value - a.value);
      const totalLatest = latest.total || d3.sum(totalsLatest, d => d.value);
      const top = totalsLatest[0];
      const messageOne = def.field
        ? `In ${latest.year}, ${top.key} accounted for ${formatPercent(top.value / totalLatest || 0)} of urban deaths.`
        : `In ${latest.year}, total recorded urban deaths reached ${formatNumber(totalLatest)}.`;

      const deltas = keys
        .filter(key => key !== 'Other' || def.field)
        .map(key => ({
          key,
          delta: (latest[key] || 0) - (earliest[key] || 0),
          start: earliest[key] || 0,
          end: latest[key] || 0
        }));
      deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const mover = deltas[0];
      const messageTwo = mover
        ? `${mover.key} ${mover.delta >= 0 ? 'gained' : 'lost'} ${formatNumber(Math.abs(mover.delta))} deaths between ${earliest.year} and ${latest.year}.`
        : '';

      return [messageOne, messageTwo].filter(Boolean);
    }

    nextBtn.on('click', () => {
      if (!insightMessages.length) return;
      insightIndex = (insightIndex + 1) % insightMessages.length;
      insightText.text(insightMessages[insightIndex]);
    });

    const areaGenerator = d3.area()
      .curve(d3.curveCatmullRom.alpha(0.5))
      .x(d => xScale(d.data.year))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]));

    const stack = d3.stack().order(d3.stackOrderNone).offset(d3.stackOffsetNone);

    let activeConfig = fieldConfigs[0];

    function refreshButtons() {
      fieldConfigs.forEach(cfg => {
        d3.select(cfg.button).classed('active', cfg.id === activeConfig.id);
      });
      insightHeader.text(`Key Insights — ${activeConfig.label}`);
    }

    function handleHover(event, layer, stackData, keys) {
      const [xPos] = d3.pointer(event, g.node());
      const yearValue = Math.round(xScale.invert(xPos));
      const closest = stackData.reduce((acc, row) => {
        if (!acc) return row;
        return Math.abs(row.year - yearValue) < Math.abs(acc.year - yearValue) ? row : acc;
      }, null);
      if (!closest) return;
      const value = closest[layer.key] || 0;
      const share = closest.total ? value / closest.total : 0;
      const [cx, cy] = d3.pointer(event, chartContentNode);
      tooltip.style('display', 'block')
        .style('left', `${cx + 16}px`)
        .style('top', `${cy - 10}px`)
        .html(
          `<div><strong>${layer.key}</strong> — ${closest.year}</div>` +
          `<div>${formatNumber(value)} deaths</div>` +
          (activeConfig.field ? `<div>${formatPercent(share)} of year</div>` : '')
        );
    }

    function hideTooltip() {
      tooltip.style('display', 'none');
    }

    function updateChart() {
      const { data, keys } = buildStackData(rows, activeConfig.field);
      if (!data.length) return;
      stack.keys(keys);
      const layers = stack(data);
      const yearExtent = d3.extent(data, d => d.year);
      const maxY = d3.max(data, d => d3.sum(keys, key => d[key] || 0));
      xScale.domain(yearExtent);
      yScale.domain([0, maxY]).nice();
      colorScale.domain(keys);

      const layersSel = g.selectAll('.stack-layer').data(layers, d => d.key);
      layersSel.enter()
        .append('path')
        .attr('class', 'stack-layer')
        .attr('fill', d => colorScale(d.key))
        .attr('opacity', 0.9)
        .attr('d', areaGenerator)
        .merge(layersSel)
        .transition()
        .duration(600)
        .attr('d', areaGenerator)
        .attr('fill', d => colorScale(d.key));
      layersSel.exit().remove();

      g.selectAll('.stack-layer')
        .on('pointermove', function (event, layer) {
          handleHover(event, layer, data, keys);
        })
        .on('pointerleave', hideTooltip);

      const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d'));
      const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => d3.format('.2s')(d).replace('G', 'B'));
      g.selectAll('.x-axis').data([null]).join('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);
      g.selectAll('.y-axis').data([null]).join('g')
        .attr('class', 'y-axis')
        .call(yAxis);

      updateLegend(keys);
      insightMessages = buildInsights(activeConfig, data, keys);
      insightIndex = 0;
      insightText.text(insightMessages[0] || 'Select a filter to view insights.');
    }

    fieldConfigs.forEach(cfg => {
      const button = d3.select(cfg.button);
      if (button.empty()) return;
      button.on('click', () => {
        activeConfig = cfg;
        refreshButtons();
        updateChart();
      });
    });

    refreshButtons();
    updateChart();
  };
})();
