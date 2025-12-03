// urban-trends.js
// Creates the stacked area "trends" visualization powered by the Urban dataset.
(function () {
  const urbanLocalPath = '../Data/Urban.csv';
  const urbanRemotePath = 'https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/Urban.csv';
  const ageLocationLocalPath = '../Data/ageLocation.csv';
  const ageLocationRemotePath = 'https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/refs/heads/main/Data/ageLocation.csv';

  async function loadWithFallback(localPath, remotePath) {
    async function tryLoad(path) {
      const rows = await d3.csv(path);
      if (!rows || !rows.length) throw new Error('Empty CSV');
      return rows;
    }
    try {
      return await tryLoad(localPath);
    } catch (err) {
      console.warn(`Urban trends: local load failed (${err.message}). Trying remote at ${remotePath}.`);
      return await tryLoad(remotePath);
    }
  }

  async function loadUrbanCsv() {
    return loadWithFallback(urbanLocalPath, urbanRemotePath);
  }

  async function loadAgeLocationCsv() {
    return loadWithFallback(ageLocationLocalPath, ageLocationRemotePath);
  }

  const fieldConfigs = [
    { id: 'gender', label: 'Gender', button: '#gender-button', dataset: 'urban', accessor: r => r.sex, includeOther: false },
    { id: 'urbanization', label: 'Urbanization', button: '#urban-button', dataset: 'urban', accessor: r => r.place, includeOther: false },
    { id: 'ethnicity', label: 'Ethnicity', button: '#ethnicity-button', dataset: 'urban', accessor: r => r.race },
    { id: 'cause', label: 'Cause Chapter', button: '#cause-button', dataset: 'urban', accessor: r => r.cause },
    { id: 'age', label: 'Age Group', button: '#age-button', dataset: 'agePlace', accessor: r => r.ageGroup },
    { id: 'placeOfDeath', label: 'Place of Death', button: '#place-death-button', dataset: 'agePlace', accessor: r => r.placeOfDeath },
    { id: 'total', label: 'Total', button: '#total-button', dataset: 'urban', accessor: null }
  ];

  function normalizeUrbanRows(rows) {
    return rows.map(r => {
      const rawYear = (r.Year || '').toString().trim();
      const fallback = r['Year Code'] ? String(r['Year Code']) : '';
      const label = rawYear || fallback;
      const numericYearString = label.replace(/[^\d]/g, '');
      const yearValue = numericYearString ? +numericYearString : +r['Year Code'] || null;
      return {
        year: yearValue,
        yearLabel: label || (yearValue ? String(yearValue) : ''),
        deaths: +r.Deaths || 0,
        sex: r.Sex || '(missing)',
        race: r['Single Race 6'] || '(missing)',
        place: r['Residence 2013 Urbanization'] || '(missing)',
        cause: r['UCD - ICD Chapter'] || '(missing)'
      };
    }).filter(r => r.year && r.deaths > 0);
  }

  function normalizeAgeLocationRows(rows) {
    return rows.map(r => {
      const rawYear = (r.Year || '').toString().trim();
      const fallback = r['Year Code'] ? String(r['Year Code']) : '';
      const label = rawYear || fallback;
      const numericYearString = label.replace(/[^\d]/g, '');
      const yearValue = numericYearString ? +numericYearString : +r['Year Code'] || null;
      const age = (r['Ten-Year Age Groups'] || '').trim();
      const pod = (r['Place of Death'] || '').trim();
      return {
        year: yearValue,
        yearLabel: label || (yearValue ? String(yearValue) : ''),
        deaths: +r.Deaths || 0,
        ageGroup: age || '(missing)',
        placeOfDeath: pod || '(missing)'
      };
    }).filter(r => r.year && r.deaths > 0 && r.ageGroup);
  }

  function buildStackData(rows, accessor, maxSegments = 6, includeOther = true) {
    const rowsGrouped = d3.group(rows, r => r.year);
    const yearsMeta = Array.from(rowsGrouped.keys()).map(year => {
      const groupRows = rowsGrouped.get(year) || [];
      const label = groupRows.find(r => r.yearLabel)?.yearLabel || String(year);
      return { year, label };
    }).sort((a, b) => a.year - b.year);
    const totalByKey = new Map();
    const fieldAccessor = accessor ? accessor : () => 'Total';

    rows.forEach(r => {
      const key = accessor ? (fieldAccessor(r) || '(missing)') : 'Total';
      totalByKey.set(key, (totalByKey.get(key) || 0) + r.deaths);
    });

    let keys;
    if (!accessor) {
      keys = ['Total'];
    } else {
      const ordered = Array.from(totalByKey.entries()).sort((a, b) => b[1] - a[1]);
      keys = ordered.slice(0, maxSegments).map(([key]) => key);
      if (includeOther) keys.push('Other');
    }

    const data = yearsMeta.map((meta, idx) => {
      const rowsInYear = rowsGrouped.get(meta.year) || [];
      const sums = d3.rollup(rowsInYear, v => d3.sum(v, d => d.deaths), r => accessor ? fieldAccessor(r) || '(missing)' : 'Total');
      const entry = { year: meta.year, yearLabel: meta.label, position: idx };
      let otherTotal = 0;
      keys.forEach(key => {
        if (key === 'Other') return;
        entry[key] = sums.get(key) || 0;
      });
      if (accessor && includeOther) {
        sums.forEach((value, key) => {
          if (!keys.includes(key)) otherTotal += value;
        });
        entry.Other = otherTotal;
      }
      entry.total = d3.sum(keys, key => entry[key] || 0);
      return entry;
    });
    return { data, keys, yearMeta: yearsMeta };
  }

  function formatNumber(value) {
    return d3.format(',')(value);
  }

  function formatPercent(value) {
    return d3.format('.1%')(value);
  }

  window.renderUrbanTrends = async function renderUrbanTrends(containerSelector = '#trends-container', preloadedRows = null) {
    let urbanRowsRaw = [];
    let ageLocationRowsRaw = [];
    try {
      urbanRowsRaw = preloadedRows && preloadedRows.length ? preloadedRows : await loadUrbanCsv();
    } catch (err) {
      console.warn('Urban trends: failed to load urban dataset', err && err.message ? err.message : err);
    }
    try {
      ageLocationRowsRaw = await loadAgeLocationCsv();
    } catch (err) {
      console.warn('Urban trends: failed to load age/place dataset', err && err.message ? err.message : err);
    }

    const datasets = {
      urban: normalizeUrbanRows(urbanRowsRaw),
      agePlace: normalizeAgeLocationRows(ageLocationRowsRaw)
    };
    if (!datasets.urban.length && !datasets.agePlace.length) {
      throw new Error('Urban trends datasets empty for trends module');
    }

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
    const colorPalette = ['#005F73', '#0A9396', '#94D2BD', '#E9D8A6', '#EE9B00', '#CA6702', '#BB3E03', '#9B2226', '#3D5A80', '#BC4749'];
    const colorScale = d3.scaleOrdinal(colorPalette).unknown('#94a3b8');

    const chartContent = container.select('#stack-chart-content');
    const chartContentNode = chartContent.empty() ? container.node() : chartContent.node();
    const legend = container.select('#stack-legend .legend-items');
    const focusSvg = chartContent.select('.focus-chart-svg');
    const focusEmpty = chartContent.select('.focus-chart-empty');
    const insightHeader = container.select('#trends-insights-header');
    const insightText = container.select('#trends-text');
    const nextBtn = container.select('#trends-next');
    const tooltip = chartContent.selectAll('.stack-tooltip').data([null]).join('div').attr('class', 'stack-tooltip');
    const hoverLine = g.append('line')
      .attr('class', 'stack-hover-line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    let insightMessages = [];
    let insightIndex = 0;
    let currentStackData = [];
    let currentKeys = [];
    let activeFocusKey = null;

    function getRowsForConfig(cfg) {
      const datasetId = cfg && cfg.dataset ? cfg.dataset : 'urban';
      return datasets[datasetId] || [];
    }

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
      const viewLabel = def.dataset === 'urban' ? 'urban deaths' : 'deaths in this view';
      const messageOne = def.accessor
        ? `In ${latest.year}, ${top.key} accounted for ${formatPercent(top.value / totalLatest || 0)} of ${viewLabel}.`
        : `In ${latest.year}, total recorded urban deaths reached ${formatNumber(totalLatest)}.`;

      const deltas = keys
        .filter(key => key !== 'Other' || def.accessor)
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
      .x(d => xScale(d.data.position))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]));

    const stack = d3.stack().order(d3.stackOrderNone).offset(d3.stackOffsetNone);

    svg.on('click', () => {
      if (!activeFocusKey) return;
      activeFocusKey = null;
      syncFocusState();
    });

    let activeConfig = fieldConfigs[0];

    function refreshButtons() {
      fieldConfigs.forEach(cfg => {
        d3.select(cfg.button).classed('active', cfg.id === activeConfig.id);
      });
      insightHeader.text(`Key Insights — ${activeConfig.label}`);
    }

    function handleHover(event, layer, stackData, keys) {
      const [xPos] = d3.pointer(event, g.node());
      const posValue = Math.round(xScale.invert(xPos));
      const idx = Math.max(0, Math.min(stackData.length - 1, posValue));
      const closest = stackData[idx];
      if (!closest) return;
      const value = closest[layer.key] || 0;
      const share = closest.total ? value / closest.total : 0;
      const xCoord = xScale(closest.position);
      hoverLine
        .attr('x1', xCoord)
        .attr('x2', xCoord)
        .style('opacity', 1);
      const [cx, cy] = d3.pointer(event, chartContentNode);
      tooltip.style('display', 'block')
        .style('left', `${cx + 16}px`)
        .style('top', `${cy - 10}px`)
        .html(
          `<div><strong>${layer.key}</strong> — ${closest.year}</div>` +
          (closest.yearLabel && closest.yearLabel !== String(closest.year) ? `<div>${closest.yearLabel}</div>` : '') +
          `<div>${formatNumber(value)} deaths</div>` +
          (activeConfig.accessor ? `<div>${formatPercent(share)} of all deaths in this year</div>` : '') +
          `<div style="margin-top:4px;font-size:0.75rem;color:#cbd5f5;">Click this layer to pin its trend in the focus panel.</div>`
        );
    }

    function hideTooltip() {
      tooltip.style('display', 'none');
      hoverLine.style('opacity', 0);
    }

    const focusMargin = { top: 20, right: 30, bottom: 30, left: 60 };
    const focusHeight = 220;

    function toggleFocusVisibility(active) {
      if (focusSvg.empty() || focusEmpty.empty()) return;
      focusSvg.style('display', active ? 'block' : 'none');
      focusEmpty.style('display', active ? 'none' : 'flex');
    }

    function renderFocusChart() {
      if (focusSvg.empty()) return;
      const hasFocus = !!(activeFocusKey && currentStackData.length);
      toggleFocusVisibility(hasFocus);
      focusSvg.selectAll('*').remove();
      if (!hasFocus) return;

      const focusWidth = width;
      focusSvg.attr('viewBox', `0 0 ${focusWidth} ${focusHeight}`);
      const innerWidthFocus = focusWidth - focusMargin.left - focusMargin.right;
      const innerHeightFocus = focusHeight - focusMargin.top - focusMargin.bottom;
      const series = currentStackData.map(d => ({
        year: d.year,
        value: d[activeFocusKey] || 0
      }));
      const fx = d3.scaleLinear().domain(d3.extent(series, d => d.year)).range([0, innerWidthFocus]);
      const fy = d3.scaleLinear().domain([0, d3.max(series, d => d.value) || 1]).nice().range([innerHeightFocus, 0]);

      const area = d3.area()
        .curve(d3.curveCatmullRom.alpha(0.5))
        .x(d => fx(d.year))
        .y0(innerHeightFocus)
        .y1(d => fy(d.value));
      const line = d3.line()
        .curve(d3.curveCatmullRom.alpha(0.5))
        .x(d => fx(d.year))
        .y(d => fy(d.value));

      const baseColor = d3.color(colorScale(activeFocusKey) || '#4e79a7');
      const areaColor = baseColor && baseColor.brighter ? baseColor.brighter(1.2).formatHex() : '#cbd5ff';
      const focusStroke = baseColor ? baseColor.formatHex() : '#4e79a7';

      const focusGroup = focusSvg.append('g').attr('transform', `translate(${focusMargin.left},${focusMargin.top})`);
      focusGroup.append('path')
        .datum(series)
        .attr('fill', areaColor)
        .attr('opacity', 0.35)
        .attr('d', area);
      focusGroup.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', focusStroke)
        .attr('stroke-width', 2.5)
        .attr('d', line);
      focusGroup.append('g')
        .attr('class', 'focus-x-axis')
        .attr('transform', `translate(0,${innerHeightFocus})`)
        .call(d3.axisBottom(fx).tickFormat(d3.format('d')));
      focusGroup.append('g')
        .attr('class', 'focus-y-axis')
        .call(d3.axisLeft(fy).ticks(4).tickFormat(d => d3.format('.2s')(d).replace('G', 'B')));
      focusGroup.append('text')
        .attr('x', 0)
        .attr('y', -6)
        .attr('fill', '#0f172a')
        .attr('font-size', '0.85rem')
        .attr('font-weight', '600')
        .text(`${activeFocusKey}`);
    }

    function handleLayerClick(layerKey) {
      if (!layerKey) return;
      if (activeFocusKey === layerKey) activeFocusKey = null;
      else activeFocusKey = layerKey;
      syncFocusState();
    }

    function syncFocusState() {
      renderFocusChart();
      g.selectAll('.stack-layer').classed('focused', d => d.key === activeFocusKey);
    }

    function updateChart() {
      const rowsForConfig = getRowsForConfig(activeConfig);
      if (!rowsForConfig.length) {
        currentStackData = [];
        currentKeys = [];
        legend.selectAll('.legend-item').remove();
        g.selectAll('.stack-layer').remove();
        toggleFocusVisibility(false);
        insightMessages = [];
        insightText.text('Data unavailable for this view.');
        return;
      }

      const includeOther = activeConfig.includeOther !== false;
      const { data, keys } = buildStackData(rowsForConfig, activeConfig.accessor, 6, includeOther);
      if (!data.length) return;
      stack.keys(keys);
      const layers = stack(data);
      const positionExtent = d3.extent(data, d => d.position);
      const maxY = d3.max(data, d => d3.sum(keys, key => d[key] || 0));
      xScale.domain(positionExtent);
      yScale.domain([0, maxY]).nice();
      colorScale.domain(keys);
      currentStackData = data;
      currentKeys = keys;
      if (activeFocusKey && !keys.includes(activeFocusKey)) activeFocusKey = null;

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
          g.selectAll('.stack-layer').attr('opacity', 0.25);
          d3.select(this).attr('opacity', 0.9);
          handleHover(event, layer, data, keys);
        })
        .on('pointerleave', function () {
          g.selectAll('.stack-layer').attr('opacity', 0.9);
          hideTooltip();
        })
        .on('click', function (event, layer) {
          event.stopPropagation();
          handleLayerClick(layer.key);
        });
      if (hoverLine.raise) hoverLine.raise();

      const tickPositions = data.map(d => d.position);
      const positionToLabel = new Map(data.map(d => [d.position, d.yearLabel || String(d.year)]));
      const xAxis = d3.axisBottom(xScale)
        .tickValues(tickPositions)
        .tickFormat(pos => {
          const raw = positionToLabel.get(pos) || '';
          const digits = raw.replace(/[^\d]/g, '');
          return digits || raw;
        });
      const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => d3.format('.2s')(d).replace('G', 'B'));
      const xAxisG = g.selectAll('.x-axis').data([null]).join('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);
      xAxisG.selectAll('.tick title').remove();
      xAxisG.selectAll('.tick')
        .append('title')
        .text(pos => positionToLabel.get(pos));
      g.selectAll('.y-axis').data([null]).join('g')
        .attr('class', 'y-axis')
        .call(yAxis);

      updateLegend(keys);
      insightMessages = buildInsights(activeConfig, data, keys);
      insightIndex = 0;
      insightText.text(insightMessages[0] || 'Select a filter to view insights.');
      syncFocusState();
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

