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

  function buildHierarchy(rows, f1, f2) {
    const root = { name: 'root', children: [] };
    if (!f1) {
      // total
      const total = d3.sum(rows, r => +r.Deaths || +r.deaths || 0);
      root.value = total;
      return root;
    }

    const group1 = d3.rollups(rows, v => d3.sum(v, r => +r.Deaths || +r.deaths || 0), d => d[f1]);
    root.children = group1.map(([k1, v1]) => {
      const node = { name: k1 || '(missing)', children: [] };
      if (!f2) {
        node.value = v1;
      } else {
        const rows1 = rows.filter(r => (r[f1] || '') === k1);
        const group2 = d3.rollups(rows1, v => d3.sum(v, r => +r.Deaths || +r.deaths || 0), d => d[f2]);
        node.children = group2.map(([k2, v2]) => ({ name: k2 || '(missing)', value: v2 }));
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
    const yearLabel = controls.append('label').style('margin-right', '12px');
    yearLabel.append('strong').text('Year: ');
    const yearSelect = yearLabel.append('select').attr('id', 'urban-year-select').style('margin-left', '6px');
    yearSelect.selectAll('option').data(years).join('option').attr('value', d => d).text(d => d).property('selected', d => d === defaultYear);

    const fields = getCategoricalFields(rows).slice(0, 12);
    controls.append('div').style('margin-top', '8px').append('strong').text('Select up to two filters:');
    const buttons = controls.append('div').attr('id', 'urban-filter-buttons').style('display', 'flex').style('gap', '8px').style('flex-wrap', 'wrap').style('margin-top', '6px');
    let selected = [];

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
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const tooltip = chartDiv.append('div').style('position', 'absolute').style('pointer-events', 'none').style('background', '#fff').style('padding', '6px 8px').style('border', '1px solid #ccc').style('border-radius', '4px').style('display', 'none');

    function updateChart() {
      // filter rows by selected year
      const selYear = d3.select('#urban-year-select').node().value;
      const rowsYear = selYear ? rows.filter(r => (r.Year || r.year) == selYear) : rows;

      const f1 = selected[0] || null;
      const f2 = selected[1] || null;
      const hierarchy = d3.hierarchy(buildHierarchy(rowsYear, f1, f2)).sum(d => d.value || 0);
      partition(hierarchy);

      const nodes = g.selectAll('path').data(hierarchy.descendants().filter(d => d.depth > 0), d => d.data.name + '-' + d.depth);

      nodes.join(
        enter => enter.append('path').attr('d', arc).attr('fill', d => color((d.children ? d : d.parent).data.name)).attr('stroke', '#fff').on('mouseover', (event, d) => {
          const name = d.data.name;
          const val = d.value;
          tooltip.style('display', 'block').html(`<strong>${name}</strong><br/>Deaths: ${d3.format(',')(val)}`);
        }).on('mousemove', (event) => {
          tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
        }).on('mouseout', () => tooltip.style('display', 'none')),
        update => update.transition().duration(600).attr('d', arc),
        exit => exit.remove()
      );

      // Center label showing total for year
      const total = d3.sum(rowsYear, r => +r.Deaths || +r.deaths || 0);
      const centerText = g.selectAll('text.center').data([total]);
      centerText.join(enter => enter.append('text').attr('class', 'center').attr('text-anchor', 'middle').attr('dy', '0.35em').style('font-size', '14px').text(d => `Total deaths: ${d3.format(',')(d)}`), update => update.text(d => `Total deaths: ${d3.format(',')(d)}`));
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
