(function () {
  window.renderChoropleth = function (containerId, deathData, us, options = {}) {
    const { race = null, sex = null, cause = null, causeLabel = null, width = 900, height = 600, onStateClick = null } = options;

    const filtered = deathData.filter(d =>
      (race ? d.race === race : true) &&
      (sex ? d.sex === sex : true) &&
      (cause ? d.cause === cause : true) &&
      d.stateFips
    );

    const byState = new Map(filtered.map(d => [d.stateFips, d.rate]));

    let states = null;
    if (us.objects.states) {
      states = topojson.feature(us, us.objects.states);
    } else if (us.objects && us.objects.counties && us.objects.nation) {
      states = {type: "FeatureCollection", features: []};
    } else {
      container.selectAll('*').remove();
      container.append('div').style('color','red').text('Could not find US states in TopoJSON.');
      return;
    }

    const projection = d3.geoAlbersUsa();
    const path = d3.geoPath().projection(projection);

    const topMargin = 60;

    projection.fitSize([width, height - topMargin], states);

    const values = filtered.map(d => d.rate).filter(v => Number.isFinite(v));
    const [vmin, vmax] = d3.extent(values);
    const color = d3.scaleQuantize()
      .domain(vmin == null ? [0, 1] : [vmin, vmax])
      .range(d3.schemeBlues[9]);

    const container = d3.select(containerId);
    container.selectAll('*').remove();

    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('max-width', '100%')
      .style('height', 'auto');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 32)
      .attr('text-anchor', 'middle')
      .attr('font-size', 18)
      .attr('font-weight', 700)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#0b1020')
      .attr('stroke-width', 0.4)
      .attr('paint-order', 'stroke')
      .attr('dominant-baseline', 'middle')
      .text(causeLabel || cause || 'All causes');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 54)
      .attr('text-anchor', 'middle')
      .attr('font-size', 14)
      .attr('font-weight', 500)
      .attr('fill', '#e5e7eb')
      .attr('dominant-baseline', 'middle')
      .text([race || 'All races', sex || 'All sexes'].filter(Boolean).join(' - '));

    const legendG = svg.append('g').attr('transform', `translate(${width - 340}, 70)`);
    legendG.append('rect')
      .attr('x', -10)
      .attr('y', -18)
      .attr('width', 320)
      .attr('height', 64)
      .attr('fill', 'rgba(5,8,22,0.85)')
      .attr('stroke', 'rgba(148,163,184,0.35)')
      .attr('rx', 10);
    const buckets = color.range();
    const legendItemW = 20;
    legendG.selectAll('rect.legend-swatch').data(buckets).join('rect')
      .attr('class', 'legend-swatch')
      .attr('x', (d, i) => i * (legendItemW + 2))
      .attr('y', 0)
      .attr('width', legendItemW)
      .attr('height', 12)
      .attr('rx', 0)
      .attr('fill', d => d);
    legendG.append('text').attr('x', 0).attr('y', -6).text('Crude rate per 100,000').attr('font-size', 11).attr('fill', '#e5e7eb');

    if (buckets.length > 1) {
      const step = (vmax - vmin) / buckets.length;
      const tickValues = Array.from({length: buckets.length + 1}, (_, i) => vmin + i * step);
      legendG.selectAll('text.legend-tick')
        .data(tickValues)
        .join('text')
        .attr('class', 'legend-tick')
        .attr('x', (d, i) => i * (legendItemW + 2))
        .attr('y', 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('fill', '#e5e7eb')
        .attr('transform', (d, i) => `rotate(35 ${(i * (legendItemW + 2))},36)`)
        .text((d, i) => d3.format('.1f')(d));
    }


    const statesG = svg.append('g').attr('transform', `translate(0, ${topMargin})`);

    statesG
      .selectAll('path')
      .data(states.features)
      .join('path')
      .attr('fill', d => {
        const id = String(d.id).padStart(2, '0');
        const v = byState.get(id);
        return Number.isFinite(v) ? color(v) : '#eee';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('d', path)
      .style('cursor', onStateClick ? 'pointer' : 'default')
      .on('click', function (event, d) {
        if (typeof onStateClick === 'function') {
          const id = String(d.id).padStart(2, '0');
          onStateClick(d.properties.name, id);
        }
      })
      .on('mouseover', function () { d3.select(this).attr('stroke', '#000').attr('stroke-width', 2); })
      .on('mouseout', function () { d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1); })
      .append('title')
      .text(d => {
        const id = String(d.id).padStart(2, '0');
        const v = byState.get(id);
        const stateName = d.properties.name;
        return Number.isFinite(v)
          ? `${stateName}\nCrude rate: ${d3.format('.1f')(v)}`
          : `${stateName}\nNo reliable data`;
      });

    // Draw state borders if possible
    if (us.objects.states) {
      svg.append('path')
        .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
        .attr('fill', 'none')
        .attr('stroke', '#fff')
        .attr('stroke-linejoin', 'round')
        .attr('transform', `translate(0, ${topMargin})`)
        .attr('d', path);
    }
  };
})();
