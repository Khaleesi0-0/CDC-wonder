(function () {
  window.renderUcdMcd = function (containerId, data) {
    data.forEach(d => {
      d.Deaths = +d.Deaths;
      d.Population = +d.Population;
    });

    let chapterArray = Array.from(
      d3.group(data, d => d["UCD - ICD Chapter"]),
      ([chapter, rows]) => ({
        chapter,
        totalDeaths: d3.sum(rows, d => d.Deaths),
        totalPopulation: d3.sum(rows, d => d.Population)
      })
    ).sort((a, b) => b.totalDeaths - a.totalDeaths);
    if (chapterArray.length > 5) {
      chapterArray = chapterArray.slice(0, chapterArray.length - 5);
    }

    const width = 900;
    const topHeight = 300;
    const bottomHeight = 350;
    const margin = { top: 40, right: 30, bottom: 40, left: 220 };

    const container = d3.select(containerId);
    container.selectAll('*').remove();


    const wrapper = container.append('div').style('font-family', 'system-ui, sans-serif');
    wrapper.append('h2')
      .text('CDC Mortality Data - UCD Chapters and Sub-Chapters')
      .style('font-size', '2.2rem')
      .style('font-weight', '800')
      .style('margin-bottom', '0.5rem')
      .style('text-align', 'center');

    wrapper.append('h3')
      .text('UCD – ICD Chapter (click to explore sub-chapters)')
      .style('font-size', '1.3rem')
      .style('font-weight', '600')
      .style('margin-bottom', '1.5rem')
      .style('text-align', 'center');

    const topSvg = wrapper.append('svg').attr('width', width).attr('height', topHeight);
    const topInner = topSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const topInnerWidth = width - margin.left - margin.right;
    const topInnerHeight = topHeight - margin.top - margin.bottom;

    const yChapter = d3.scaleBand().domain(chapterArray.map(d => d.chapter)).range([0, topInnerHeight]).padding(0.2);
    const xDeaths = d3.scaleLinear().domain([0, d3.max(chapterArray, d => d.totalDeaths)]).nice().range([0, topInnerWidth]);

    const yAxis = d3.axisLeft(yChapter).tickFormat(d => {
      const maxLen = 28;
      return d.length > maxLen ? d.slice(0, maxLen - 1) + '…' : d;
    });
    const yAxisG = topInner.append('g').attr('class', 'y-axis').call(yAxis);
    // Add title (tooltip) for full label
    yAxisG.selectAll('.tick text').append('title').text(d => d);
    topInner.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${topInnerHeight})`).call(d3.axisBottom(xDeaths));
    topInner.append('text')
      .attr('x', topInnerWidth / 2)
      .attr('y', topInnerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '1.1rem')
      .attr('font-weight', '600')
      .text('Total Deaths');

    const bars = topInner.selectAll('.chapter-bar').data(chapterArray).join('rect')
      .attr('class', 'chapter-bar')
      .attr('x', 0)
      .attr('y', d => yChapter(d.chapter))
      .attr('height', yChapter.bandwidth())
      .attr('width', d => xDeaths(d.totalDeaths))
      .attr('fill', '#4e79a7')
      .attr('rx', 4)
      .attr('ry', 4)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.07))');

    topInner.selectAll('.chapter-label').remove();

    let tooltip = d3.select('body').select('.ucd-mcd-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('class', 'ucd-mcd-tooltip')
        .style('position', 'absolute')
        .style('z-index', 1000)
        .style('background', 'rgba(30,30,30,0.95)')
        .style('color', '#fff')
        .style('padding', '6px 12px')
        .style('border-radius', '6px')
        .style('font-size', '1rem')
        .style('pointer-events', 'none')
        .style('display', 'none');
    }

    bars.on('mouseover', function(event, d) {
      tooltip.style('display', 'block')
        .html(
          `<strong>${d.chapter}</strong><br/>` +
          `Total deaths across all years: ${d3.format(',')(d.totalDeaths)}<br/>` +
          `<span style="font-size:0.8rem;color:#cbd5f5;">Click to see the leading sub-chapters within this category.</span>`
        );
      d3.select(this).attr('fill', '#1761a0');
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 18) + 'px');
    })
    .on('mouseout', function(event, d) {
      tooltip.style('display', 'none');
      d3.select(this).attr('fill', b => b.chapter === d.chapter ? '#1f77b4' : '#4e79a7');
    });

    const bottomTitle = wrapper.append('h3')
      .attr('id', 'bottom-title')
      .style('font-size', '1.2rem')
      .style('font-weight', '600')
      .style('margin-top', '2.5rem')
      .style('margin-bottom', '1rem')
      .style('text-align', 'center');
    const bottomSvg = wrapper.append('svg').attr('width', width).attr('height', bottomHeight);
    const bottomInner = bottomSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const bottomInnerWidth = width - margin.left - margin.right;
    const bottomInnerHeight = bottomHeight - margin.top - margin.bottom;

    const yCause = d3.scaleBand().range([0, bottomInnerHeight]).padding(0.2);
    const xCauseDeaths = d3.scaleLinear().range([0, bottomInnerWidth]);

    bottomInner.append('g').attr('class', 'y-axis-bottom');
    bottomInner.append('g').attr('class', 'x-axis-bottom').attr('transform', `translate(0,${bottomInnerHeight})`);
    bottomInner.append('text').attr('class', 'x-label-bottom').attr('x', bottomInnerWidth / 2).attr('y', bottomInnerHeight + 35).attr('text-anchor', 'middle').text('Total Deaths');

    function updateBottom(selectedChapter) {
      const rowsInChapter = data.filter(d => d['UCD - ICD Chapter'] === selectedChapter);
      bottomTitle.text(`Top 10 UCD – ICD Sub-Chapters for: ${selectedChapter}`);

      let causeArray = Array.from(
        d3.group(rowsInChapter, d => d['UCD - ICD Sub-Chapter']),
        ([subChapter, rows]) => ({ subChapter, totalDeaths: d3.sum(rows, d => d.Deaths) })
      )
        .sort((a, b) => b.totalDeaths - a.totalDeaths).slice(0, 10);

      function stripParens(str) {
        return (str || '').replace(/\s*\([^)]*\)/g, '').trim();
      }

      function formatLabel(str) {
        const safe = str || '';
        const maxLen = 28;
        return safe.length > maxLen ? safe.slice(0, maxLen - 1) + '…' : safe;
      }

      yCause.domain(causeArray.map(d => stripParens(d.subChapter)));
      xCauseDeaths.domain([0, d3.max(causeArray, d => d.totalDeaths)]).nice();

      const yAxisBottom = d3.axisLeft(yCause).tickFormat(formatLabel).tickSizeOuter(0);
      const yAxisBottomG = bottomInner.select('.y-axis-bottom').call(yAxisBottom);
      yAxisBottomG.selectAll('.tick text').append('title').text(d => stripParens(d));

      bottomInner.select('.x-axis-bottom').call(d3.axisBottom(xCauseDeaths));

      bottomInner.selectAll('.cause-label').remove();

      const causeBars = bottomInner.selectAll('.cause-bar').data(causeArray, d => d.subChapter);
      causeBars.join(
        enter => enter.append('rect')
          .attr('class', 'cause-bar')
          .attr('x', 0)
          .attr('y', d => yCause(stripParens(d.subChapter)))
          .attr('height', yCause.bandwidth())
          .attr('width', d => xCauseDeaths(d.totalDeaths))
          .attr('fill', '#f28e2b')
          .on('mouseover', function(event, d) {
            tooltip.style('display', 'block')
              .html(`<strong>${stripParens(d.subChapter)}</strong><br/>Total Deaths: ${d3.format(',')(d.totalDeaths)}`);
            d3.select(this).attr('fill', '#c76a13');
          })
          .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 12) + 'px')
              .style('top', (event.pageY - 18) + 'px');
          })
          .on('mouseout', function(event, d) {
            tooltip.style('display', 'none');
            d3.select(this).attr('fill', '#f28e2b');
          }),
        update => update.transition().duration(500)
          .attr('y', d => yCause(stripParens(d.subChapter)))
          .attr('height', yCause.bandwidth())
          .attr('width', d => xCauseDeaths(d.totalDeaths))
          .selection()
          .on('mouseover', function(event, d) {
            tooltip.style('display', 'block')
              .html(`<strong>${stripParens(d.subChapter)}</strong><br/>Total Deaths: ${d3.format(',')(d.totalDeaths)}`);
            d3.select(this).attr('fill', '#c76a13');
          })
          .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 12) + 'px')
              .style('top', (event.pageY - 18) + 'px');
          })
          .on('mouseout', function(event, d) {
            tooltip.style('display', 'none');
            d3.select(this).attr('fill', '#f28e2b');
          }),
        exit => exit.remove()
      );
    }

    bars.on('click', (event, d) => { bars.attr('fill', b => b.chapter === d.chapter ? '#1f77b4' : '#4e79a7'); updateBottom(d.chapter); });
    if (chapterArray.length > 0) { bars.filter((d, i) => i === 0).attr('fill', '#1f77b4'); updateBottom(chapterArray[0].chapter); }

    return wrapper.node();
  };
})();
