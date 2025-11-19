// choropleth.js
// Renders a US choropleth into a container using normalized deathData and a topojson 'us' object.
(function () {
  window.renderChoropleth = function (containerId, deathData, us, options = {}) {
    const { race = null, sex = null, cause = null, width = 900, height = 600 } = options;

    // Filter data by selections
    const filtered = deathData.filter(d =>
      (race ? d.race === race : true) &&
      (sex ? d.sex === sex : true) &&
      (cause ? d.cause === cause : true) &&
      d.stateFips
    );

    // Map state FIPS -> crude rate
    const byState = new Map(filtered.map(d => [d.stateFips, d.rate]));

    const states = topojson.feature(us, us.objects.states);

    // Use a projection that fits the US features to the SVG area so the map
    // aligns correctly with legends and controls across screen sizes.
    const projection = d3.geoAlbersUsa();
    const path = d3.geoPath().projection(projection);

    // Reserve top margin before fitting projection so fitSize can use it
    const topMargin = 60;

    // Auto-fit projection to the SVG available drawing area (account for title area)
    projection.fitSize([width, height - topMargin], states);

    const values = filtered.map(d => d.rate).filter(v => Number.isFinite(v));
    const [vmin, vmax] = d3.extent(values);
    const color = d3.scaleQuantize()
      .domain(vmin == null ? [0, 1] : [vmin, vmax])
      .range(d3.schemeBlues[9]);

    // Clear container
    const container = d3.select(containerId);
    container.selectAll('*').remove();

    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('max-width', '100%')
      .style('height', 'auto');


    // Title centered above map
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .attr('font-weight', 700)
      .text(`${cause || 'All causes'} — ${race || 'All races'} — ${sex || 'All sexes'}`);

    // Legend using rects for each color bucket
    const legendG = svg.append('g').attr('transform', `translate(${width - 320}, 18)`);
    const buckets = color.range();
    const legendItemW = 20;
    legendG.selectAll('rect').data(buckets).join('rect')
      .attr('x', (d, i) => i * (legendItemW + 2))
      .attr('y', 0)
      .attr('width', legendItemW)
      .attr('height', 12)
      .attr('fill', d => d);
    legendG.append('text').attr('x', 0).attr('y', -6).text('Crude rate per 100,000').attr('font-size', 11);

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

    svg.append('path')
      .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-linejoin', 'round')
      .attr('transform', `translate(0, ${topMargin})`)
      .attr('d', path);
  };
})();
