// deaths-sunburst.js
// Interactive sunburst/donut for Urban dataset using 'Deaths' as the value.
(function () {
  async function loadUrbanData() {
    // Attempt to load Urban.csv relative to the Website folder first.
    // If that fails (not served locally), fall back to the raw GitHub URL provided by the user.
    const localPath = '../Data/Urban.csv';
    const fallbackUrl = 'https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/refs/heads/main/Data/Urban.csv';

    // Try local path
    try {
      const rows = await d3.csv(localPath);
      if (rows && rows.length > 0) {
        console.info('Loaded Urban.csv from local path:', localPath);
        return rows;
      }
      console.warn('Local Urban.csv loaded but empty — falling back to remote URL');
    } catch (err) {
      console.warn(`Could not load local Urban.csv at ${localPath}: ${err.message}`);
    }

    // Try fallback remote URL
    try {
      const rows = await d3.csv(fallbackUrl);
      if (!rows || rows.length === 0) throw new Error('Empty or missing Urban.csv at remote URL');
      console.info('Loaded Urban.csv from remote URL:', fallbackUrl);
      return rows;
    } catch (err) {
      throw new Error(`Could not load Urban.csv from local (${localPath}) or remote (${fallbackUrl}): ${err.message}`);
    }
  }

  function getCategoricalFields(rows) {
    const sample = rows[0] || {};
    const exclude = new Set(['Deaths', 'deaths', 'Population', 'population', 'rate', 'Rate', 'year', 'Year', 'Notes']);
    return Object.keys(sample).filter(k => !exclude.has(k) && typeof sample[k] !== 'undefined');
  }

  const isCauseField = field => typeof field === 'string' && /(cause|icd)/i.test(field);
  const otherCauseLabel = 'All other causes';
  const sumDeaths = rows => d3.sum(rows, r => +r.Deaths || +r.deaths || 0);
  function summarizeRows(rows, field) {
    if (!field) return [];
    let groups = Array.from(d3.group(rows, r => r[field] || '(missing)'), ([key, valueRows]) => ({
      key: key || '(missing)',
      rows: valueRows,
      value: sumDeaths(valueRows),
      sourceKeys: [key || '(missing)']
    }));
    if (isCauseField(field) && groups.length > 10) {
      groups.sort((a, b) => d3.descending(a.value, b.value));
      const top = groups.slice(0, 10);
      const rest = groups.slice(10);
      const mergedRows = rest.reduce((acc, entry) => acc.concat(entry.rows), []);
      const mergedValue = d3.sum(rest, d => d.value);
      const mergedKeys = rest.reduce((acc, entry) => acc.concat(entry.sourceKeys || []), []);
      if (mergedValue > 0) top.push({ key: otherCauseLabel, rows: mergedRows, value: mergedValue, sourceKeys: mergedKeys });
      groups = top;
    }
    return groups;
  }

  function buildHierarchy(rows, f1, f2) {
    const root = { name: 'root', children: [] };
    if (!f1) {
      // total
      const total = sumDeaths(rows);
      root.value = total;
      return root;
    }

    const level1 = summarizeRows(rows, f1);
    root.children = level1.map(group => {
      const node = { name: group.key || '(missing)', children: [], sourceKeys: group.sourceKeys || [group.key || '(missing)'] };
      if (!f2) {
        node.value = group.value;
      } else {
        const level2 = summarizeRows(group.rows, f2);
        node.children = level2.map(child => ({
          name: child.key || '(missing)',
          value: child.value,
          sourceKeys: child.sourceKeys || [child.key || '(missing)']
        }));
        if (!node.children.length) node.value = group.value;
      }
      return node;
    });
    return root;
  }

  function render(containerSelector, rows) {
    const container = d3.select(containerSelector);
    container.selectAll('*').remove();

    const wrapper = container.append('div').attr('class', 'section sunburst').style('font-family', 'sans-serif');
    wrapper.append('div').attr('class', 'section-intro').html('<h1>Understanding Urban Deaths</h1><h5>Break down <strong>Deaths</strong> by year and up to two categorical variables. Select up to 2 filters to explore the distribution.</h5>');

    const controls = wrapper.append('div').attr('id', 'urban-controls').style('margin', '12px 0');
    // Year selector built from data
    const years = Array.from(new Set(rows.map(r => r.Year || r.year))).filter(Boolean).sort();
    const defaultYear = years.includes('2015') ? '2015' : years[0] || null;
    const defaultIndex = Math.max(0, years.indexOf(defaultYear));
    const sliderBlock = controls.append('div').attr('class', 'year-slider-control').style('margin-bottom', '16px').style('max-width', '360px');
    sliderBlock.append('div').attr('class', 'year-slider-title').text('Year');
    const sliderTrack = sliderBlock.append('div').attr('class', 'year-slider-track');
    const yearSlider = sliderTrack.append('input')
      .attr('type', 'range')
      .attr('id', 'urban-year-slider')
      .attr('min', 0)
      .attr('max', Math.max(years.length - 1, 0))
      .attr('step', 1)
      .attr('value', defaultIndex);
    const sliderLabels = sliderBlock.append('div').attr('class', 'year-slider-labels').style('display', 'flex').style('justify-content', 'space-between').style('font-weight', '600').style('margin-top', '6px');
    const formatSliderLabel = label => {
      if (!label) return '';
      const match = label.match(/^(\d{4})(.*)$/);
      if (!match) return `<span class="year-label-main">${label}</span>`;
      const suffix = (match[2] || '').trim();
      if (!suffix) return `<span class="year-label-main">${match[1]}</span>`;
      return `<span class="year-label-main">${match[1]}</span><span class="year-label-note">${suffix}</span>`;
    };
    sliderLabels.append('span').attr('class', 'year-label year-label-start').html(formatSliderLabel(years[0] || ''));
    sliderLabels.append('span').attr('class', 'year-label year-label-end').style('text-align', 'right').html(formatSliderLabel(years[years.length - 1] || ''));
    const sliderValue = sliderBlock.append('div').attr('class', 'year-slider-value').style('text-align', 'center').style('font-size', '1.25rem').style('font-weight', '600').style('margin-top', '6px').text(defaultYear || '');
    const updateSliderValue = () => {
      if (!years.length) { sliderValue.text(''); return; }
      const idx = Math.min(years.length - 1, Math.max(0, +yearSlider.node().value || 0));
      sliderValue.text(years[idx] || '');
    };
    const getSelectedYear = () => {
      if (!yearSlider.node() || !years.length) return null;
      const idx = Math.min(years.length - 1, Math.max(0, +yearSlider.node().value || 0));
      return years[idx] || null;
    };
    yearSlider.on('input', function () {
      updateSliderValue();
      updateChart();
    });
    updateSliderValue();

    const fields = getCategoricalFields(rows).slice(0, 12);
    controls.append('div').style('margin-top', '8px').append('strong').text('Select up to two filters:');
    const buttons = controls.append('div').attr('id', 'urban-filter-buttons').style('display', 'flex').style('gap', '8px').style('flex-wrap', 'wrap').style('margin-top', '6px');
    let selected = [];
    let selectedPath = null;
    let focusSelection = null;
    let hoverNode = null;
    let currentTotal = 0;
    let currentYearText = '';

    const labelMap = {
      'Sex': 'Gender',
      'Sex Code': 'Gender Code',
      'Residence 2013 Urbanization': 'Place',
      'Residence 2013 Urbanization Code': 'Place Code',
      'Single Race 6': 'Ethnicity',
      'Single Race 6 Code': 'Ethnicity Code',
      'UCD - ICD Chapter': 'Cause Chapter',
      'UCD - ICD Chapter Code': 'Cause Chapter Code',
      'MCD - ICD-10 113 Cause List': 'Cause',
      'Year': 'Year'
    };

    function fieldLabel(field) { return labelMap[field] || field; }

    function updateButtons() {
      const btns = buttons.selectAll('button').data(['Total'].concat(fields), d => d);
      const enter = btns.enter().append('button').attr('type', 'button').text(d => fieldLabel(d)).attr('class', 'btn btn-outline-secondary').style('padding', '6px 10px');
      enter.merge(btns).on('click', function (event, d) {
        if (d === 'Total') { selected = []; buttons.selectAll('button').classed('active', false).style('background', null).style('color', null); updateChart(); return; }
        // toggle selection; limit to 2
        const field = d;
        if (selected.includes(field)) selected = selected.filter(x => x !== field);
        else {
          if (selected.length < 2) selected.push(field);
          else { selected.shift(); selected.push(field); }
        }
        buttons.selectAll('button').classed('active', b => selected.includes(b)).style('background', b => selected.includes(b) ? '#1f77b4' : null).style('color', b => selected.includes(b) ? '#fff' : null);
        updateChart();
      });
      btns.exit().remove();
    }

    const focusBar = wrapper.append('div').attr('class', 'sunburst-focus').style('display', 'none').style('align-items', 'center').style('gap', '8px').style('margin', '8px 0').style('padding', '6px 14px').style('border-radius', '999px').style('background', 'rgba(15,23,42,0.08)').style('color', '#0f172a');
    const focusText = focusBar.append('span').style('font-size', '13px');
    focusBar.append('button').attr('type', 'button').text('Show all').attr('class', 'btn btn-sm btn-outline-secondary').on('click', () => {
      focusSelection = null;
      updateChart();
    });

    const breadcrumb = wrapper.append('div').attr('class', 'sunburst-path-bar').style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center').style('gap', '12px').style('margin', '14px 0').style('padding', '12px 18px').style('background', 'linear-gradient(135deg, #0f172a, #1f2937)').style('border', 'none').style('color', '#f8fafc').style('border-radius', '14px').style('box-shadow', '0 14px 32px rgba(15,23,42,0.35)');
    const crumbTrail = breadcrumb.append('div').attr('class', 'crumb-trail').style('display', 'flex').style('gap', '6px').style('flex-wrap', 'wrap');
    const crumbPercent = breadcrumb.append('div').attr('class', 'crumb-percent').style('font-weight', 'bold').style('font-size', '1.1rem');

    const vizWrap = wrapper.append('div').attr('class', 'viz-wrapper').style('display', 'flex').style('gap', '12px').style('align-items', 'flex-start');
    const chartDiv = vizWrap.append('div').attr('id', 'urban-sunburst').style('flex', '1').style('position', 'relative');
    const insights = vizWrap.append('div').attr('class', 'insights-wrapper').style('width', '320px');
    insights.append('h4').text('Suggested Explorations');
    insights.append('div').html('<ul><li>Select <strong>Cause Chapter</strong> then <strong>Place</strong> to compare locations.</li><li>Select <strong>Ethnicity</strong> + <strong>Gender</strong> to compare proportions across groups.</li></ul>');

    // Setup SVG
    const width = 700, height = 500, radius = Math.min(width, height) / 2;
    const svg = chartDiv.append('svg').attr('width', width).attr('height', height).style('max-width', '100%');
    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const partition = d3.partition().size([2 * Math.PI, radius]);
    const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).innerRadius(d => d.y0).outerRadius(d => d.y1 - 1);
    const paletteLevel1 = ['#264653', '#2a9d8f', '#6c757d', '#457b9d', '#8ab17d', '#bc6c25', '#4b5563', '#6d597a', '#5f0f40', '#3d5a80', '#e29578', '#287271'];
    const paletteLevel2 = ['#9ad0c2', '#b8c0ff', '#ffcf99', '#f8ad9d', '#a3c4f3', '#e0afa0', '#ffc8dd', '#d4a373', '#c8b6ff', '#8eecf5', '#ffafcc', '#ffe066', '#c1d3fe', '#b7e4c7', '#ffd6a5', '#ffd9da'];
    const colorLevel1 = d3.scaleOrdinal(paletteLevel1);
    const colorLevel2 = d3.scaleOrdinal(paletteLevel2);
    const getFillColor = (node) => {
      if (!node) return '#cbd5f5';
      if (node.depth === 1) return colorLevel1(node.data.name || '(missing)');
      if (node.depth > 1) {
        const parentName = (node.parent && (node.parent.data.name || '(missing)')) || '(missing)';
        const key = `${parentName}>${node.data.name || '(missing)'}`;
        return colorLevel2(key);
      }
      return '#cbd5f5';
    };

    const tooltip = chartDiv.append('div')
      .attr('class', 'sunburst-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', '#fff')
      .style('padding', '6px 10px')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('white-space', 'nowrap')
      .style('font-size', '13px')
      .style('display', 'none');

    const chartNode = chartDiv.node();
    const tooltipOffset = { x: 16, y: 16 };
    const formatDeaths = d3.format(',');
    const formatShare = d3.format('.1%');

    const hideTooltip = () => tooltip.style('display', 'none');
    function positionTooltip(event) {
      const [x, y] = d3.pointer(event, chartNode);
      tooltip.style('left', `${x + tooltipOffset.x}px`).style('top', `${y + tooltipOffset.y}px`);
    }

    function formatArcLabel(node) {
      if (!node) return 'Total';
      const parts = node.ancestors().filter(n => n.depth > 0).reverse().map(n => n.data.name || '(missing)');
      return parts.length ? parts.join(' \u203a ') : 'Total';
    }

    function updateFocusIndicator(activeField) {
      if (focusSelection && activeField) {
        focusBar.style('display', 'flex');
        focusText.text(`Focusing on ${focusSelection.label} within ${fieldLabel(activeField)}`);
      } else {
        focusBar.style('display', 'none');
      }
    }

    function getNodeColor(node) {
      if (!node) return '#6c757d';
      const base = d3.color(getFillColor(node));
      if (!base) return '#6c757d';
      const clone = base.copy ? base.copy() : d3.color(base.formatHex ? base.formatHex() : base.toString());
      if (node.depth > 1 && clone.brighter) return clone.brighter(0.4).formatHex();
      return clone.formatHex();
    }

    function buildCrumbData(node) {
      if (!node) return [{ label: 'Total', key: 'total', color: '#6c757d' }];
      const nodes = node.ancestors().filter(n => n.depth > 0).reverse();
      if (!nodes.length) return [{ label: 'Total', key: 'total', color: '#6c757d' }];
      return nodes.map((n, i) => ({
        label: n.data.name || '(missing)',
        key: `${n.data.name || '(missing)'}-${i}`,
        color: getNodeColor(n)
      }));
    }

    function updateBreadcrumbDisplay(node, total, yearText) {
      const crumbData = buildCrumbData(node);
      const crumbs = crumbTrail.selectAll('div.crumb').data(crumbData, d => d.key);
      const crumbEnter = crumbs.enter().append('div').attr('class', 'crumb').style('padding', '4px 10px').style('border-radius', '12px').style('font-size', '13px').style('color', '#fff').style('font-weight', '600');
      crumbEnter.append('span');
      crumbs.merge(crumbEnter).style('background', d => d.color || '#6c757d').select('span').text(d => d.label);
      crumbs.exit().remove();
      const value = node && node.value ? node.value : total;
      const share = total ? formatShare(value / total) : '—';
      crumbPercent.text(`${share} ${yearText}`);
    }

    function findNodeByPath(rootNode, path) {
      if (!rootNode || !path || !path.length) return rootNode;
      let current = rootNode;
      for (const label of path) {
        if (!current.children || !current.children.length) return rootNode;
        const next = current.children.find(child => (child.data.name || '(missing)') === label);
        if (!next) return rootNode;
        current = next;
      }
      return current;
    }

    function handleSelection(node, total, yearText) {
      if (!node) {
        selectedPath = null;
        if (!hoverNode) updateBreadcrumbDisplay(null, total, yearText);
        return;
      }
      selectedPath = node.ancestors().filter(n => n.depth > 0).reverse().map(n => n.data.name || '(missing)');
      if (!hoverNode) updateBreadcrumbDisplay(node, total, yearText);
    }

    function toggleFocusFromNode(node, activeField) {
      if (!node || node.depth !== 1 || !activeField) return;
      const label = node.data.name || '(missing)';
      const values = node.data.sourceKeys && node.data.sourceKeys.length ? node.data.sourceKeys : [label];
      if (focusSelection && focusSelection.label === label) focusSelection = null;
      else focusSelection = { label, values };
      updateChart();
    }

    function updateChart() {
      hideTooltip();
      hoverNode = null;
      // filter rows by selected year
      const selYear = getSelectedYear();
      sliderValue.text(selYear || '');
      let rowsYear = selYear ? rows.filter(r => (r.Year || r.year) == selYear) : rows;
      const f1 = selected[0] || null;
      const f2 = selected[1] || null;
      if (!f1) focusSelection = null;
      if (focusSelection && f1) {
        const allowed = new Set(focusSelection.values);
        const narrowed = rowsYear.filter(r => allowed.has((r[f1] || '(missing)')));
        if (narrowed.length) rowsYear = narrowed;
        else focusSelection = null;
      }
      const total = sumDeaths(rowsYear);
      const hierarchy = d3.hierarchy(buildHierarchy(rowsYear, f1, f2)).sum(d => d.value || 0);
      partition(hierarchy);
      currentTotal = total;

      const nodes = g.selectAll('path').data(hierarchy.descendants().filter(d => d.depth > 0), d => d.data.name + '-' + d.depth);
      const paths = nodes.join(
        enter => enter.append('path').attr('stroke', '#fff'),
        update => update,
        exit => exit.remove()
      );

      paths.attr('fill', d => getFillColor(d));
      paths.transition().duration(600).attr('d', arc);

      const yearText = selYear ? `in ${selYear}` : 'across all years';
      currentYearText = yearText;
      const denominator = total || 1;
      const showTooltip = (event, d) => {
        hoverNode = d;
        const value = d.value || 0;
        const shareText = total ? formatShare(value / denominator) : 'N/A';
        tooltip.style('display', 'block').html(
          `<div><strong>${formatArcLabel(d)}</strong></div>` +
          `<div>${formatDeaths(value)} deaths</div>` +
          `<div>${shareText} of ${yearText}</div>`
        );
        positionTooltip(event);
        updateBreadcrumbDisplay(d, total, yearText);
      };
      const moveTooltip = (event) => {
        if (tooltip.style('display') === 'none') return;
        positionTooltip(event);
      };
      const handleLeave = () => {
        hideTooltip();
        hoverNode = null;
        paths.classed('dimmed', false);
        const crumbNode = findNodeByPath(hierarchy, selectedPath);
        updateBreadcrumbDisplay(crumbNode || hierarchy, total, yearText);
      };

      const highlightNode = (node) => {
        const ancestors = node ? node.ancestors() : [];
        const nodesToHighlight = new Set(ancestors);
        paths.classed('dimmed', d => !nodesToHighlight.has(d));
      };

      paths.on('pointerenter', (event, d) => {
        showTooltip(event, d);
        highlightNode(d);
      }).on('pointermove', moveTooltip).on('pointerleave', handleLeave).on('click', (event, d) => {
        event.stopPropagation();
        handleSelection(d, currentTotal, currentYearText);
        if (d.depth === 1) toggleFocusFromNode(d, f1);
      });

      // Center label showing total for year
      const centerText = g.selectAll('text.center').data([total]);
      centerText.join(
        enter => enter.append('text').attr('class', 'center').attr('text-anchor', 'middle').attr('dy', '0.35em').style('font-size', '14px').text(d => `Total deaths: ${formatDeaths(d)}`),
        update => update.text(d => `Total deaths: ${formatDeaths(d)}`)
      );

      updateFocusIndicator(f1);
      if (!hoverNode) {
        const crumbNode = findNodeByPath(hierarchy, selectedPath);
        updateBreadcrumbDisplay(crumbNode || hierarchy, total, yearText);
      }
    }

    // wire year selector change
    d3.select('#urban-year-select').on('change', () => updateChart());

    updateButtons();
    updateChart();
  }

  // Expose initializer: containerSelector is a selector for a wrapper div where the module will create its UI
  window.renderUrbanDeaths = async function (containerSelector = '#urban-deaths') {
    const rows = await loadUrbanData();
    // Normalize numeric fields if needed
    rows.forEach(r => {
      if (r.Deaths) r.Deaths = +r.Deaths;
      if (r.deaths) r.Deaths = +r.deaths;
      // Remove any properties that end with 'Code' (case-insensitive) and any 'Crude Rate' field
      Object.keys(r).forEach(k => {
        if (/code$/i.test(k) || /crude rate/i.test(k)) delete r[k];
      });
    });
    render(containerSelector, rows);
    return true;
  };

})();
