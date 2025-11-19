// ucd-mcd-charts.js
// Builds the top UCD chapter bars and bottom MCD cause bars; exposes renderUcdMcd(containerId, data)
(function () {
  window.renderUcdMcd = function (containerId, data) {
    // Ensure numeric fields
    data.forEach(d => {
      d.Deaths = +d.Deaths;
      d.Population = +d.Population;
      d.Year = +d.Year;
    });

    const chapterArray = Array.from(
      d3.group(data, d => d["UCD - ICD Chapter"]),
      ([chapter, rows]) => ({
        chapter,
        totalDeaths: d3.sum(rows, d => d.Deaths),
        totalPopulation: d3.sum(rows, d => d.Population)
      })
    ).sort((a, b) => b.totalDeaths - a.totalDeaths);

    const width = 900;
    const topHeight = 300;
    const bottomHeight = 350;
    const margin = { top: 40, right: 30, bottom: 40, left: 220 };

    const container = d3.select(containerId);
    container.selectAll('*').remove();

    const wrapper = container.append('div').style('font-family', 'sans-serif');
    wrapper.append('h2').text('CDC Mortality Data - UCD Chapters and MCD Causes');

    wrapper.append('h3').text('UCD – ICD Chapter (click to explore causes)');

    const topSvg = wrapper.append('svg').attr('width', width).attr('height', topHeight);
    const topInner = topSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const topInnerWidth = width - margin.left - margin.right;
    const topInnerHeight = topHeight - margin.top - margin.bottom;

    const yChapter = d3.scaleBand().domain(chapterArray.map(d => d.chapter)).range([0, topInnerHeight]).padding(0.2);
    const xDeaths = d3.scaleLinear().domain([0, d3.max(chapterArray, d => d.totalDeaths)]).nice().range([0, topInnerWidth]);

    topInner.append('g').attr('class', 'y-axis').call(d3.axisLeft(yChapter));
    topInner.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${topInnerHeight})`).call(d3.axisBottom(xDeaths));
    topInner.append('text').attr('x', topInnerWidth / 2).attr('y', topInnerHeight + 35).attr('text-anchor', 'middle').text('Total Deaths');

    const bars = topInner.selectAll('.chapter-bar').data(chapterArray).join('rect').attr('class', 'chapter-bar').attr('x', 0)
      .attr('y', d => yChapter(d.chapter)).attr('height', yChapter.bandwidth()).attr('width', d => xDeaths(d.totalDeaths)).attr('fill', '#4e79a7').style('cursor', 'pointer');

    topInner.selectAll('.chapter-label').data(chapterArray).join('text').attr('class', 'chapter-label')
      .attr('x', d => xDeaths(d.totalDeaths) + 4).attr('y', d => yChapter(d.chapter) + yChapter.bandwidth() / 2).attr('dy', '0.35em').text(d => d3.format(',')(d.totalDeaths));

    // Bottom: MCD causes
    const bottomTitle = wrapper.append('h3').attr('id', 'bottom-title');
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
      bottomTitle.text(`Top 10 MCD – ICD-10 113 Causes for: ${selectedChapter}`);

      let causeArray = Array.from(d3.group(rowsInChapter, d => d['MCD - ICD-10 113 Cause List']), ([cause, rows]) => ({ cause, totalDeaths: d3.sum(rows, d => d.Deaths) }))
        .sort((a, b) => b.totalDeaths - a.totalDeaths).slice(0, 10);

      yCause.domain(causeArray.map(d => d.cause));
      xCauseDeaths.domain([0, d3.max(causeArray, d => d.totalDeaths)]).nice();

      bottomInner.select('.y-axis-bottom').call(d3.axisLeft(yCause).tickSizeOuter(0));
      bottomInner.select('.x-axis-bottom').call(d3.axisBottom(xCauseDeaths));

      const causeBars = bottomInner.selectAll('.cause-bar').data(causeArray, d => d.cause);
      causeBars.join(enter => enter.append('rect').attr('class', 'cause-bar').attr('x', 0).attr('y', d => yCause(d.cause)).attr('height', yCause.bandwidth()).attr('width', d => xCauseDeaths(d.totalDeaths)).attr('fill', '#f28e2b'), update => update.transition().duration(500).attr('y', d => yCause(d.cause)).attr('height', yCause.bandwidth()).attr('width', d => xCauseDeaths(d.totalDeaths)), exit => exit.remove());

      const causeLabels = bottomInner.selectAll('.cause-label').data(causeArray, d => d.cause);
      causeLabels.join(enter => enter.append('text').attr('class', 'cause-label').attr('x', d => xCauseDeaths(d.totalDeaths) + 4).attr('y', d => yCause(d.cause) + yCause.bandwidth() / 2).attr('dy', '0.35em').text(d => d3.format(',')(d.totalDeaths)), update => update.transition().duration(500).attr('x', d => xCauseDeaths(d.totalDeaths) + 4).attr('y', d => yCause(d.cause) + yCause.bandwidth() / 2), exit => exit.remove());
    }

    bars.on('click', (event, d) => { bars.attr('fill', b => b.chapter === d.chapter ? '#1f77b4' : '#4e79a7'); updateBottom(d.chapter); });
    if (chapterArray.length > 0) { bars.filter((d, i) => i === 0).attr('fill', '#1f77b4'); updateBottom(chapterArray[0].chapter); }

    return wrapper.node();
  };
})();
