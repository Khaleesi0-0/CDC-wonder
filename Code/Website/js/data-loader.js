// data-loader.js
// Loads CSV/JSON datasets used by the site and normalizes field names.
(function () {
  window.loadMortalityData = async function () {
    // URLs from the user's repo
    // Use the standard raw.githubusercontent.com pattern: /<owner>/<repo>/<branch>/<path>
    const deathUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/MortalitybyRace.csv";
    const causeUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/topDeath.csv";
    const stateTotalsUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/stateDeathTotal.csv";
    const totalStateUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/totalState.csv";
    const stateTrendUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/statedeathtrend.csv";
    const diseaseTrendUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/desease-trend.csv";
    const usUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
    let Death, Cause, stateTotals, totalState, stateTrend, diseaseTrend, us;
    try {
      [Death, Cause, stateTotals, totalState, stateTrend, diseaseTrend, us] = await Promise.all([
        d3.csv(deathUrl),
        d3.csv(causeUrl),
        d3.csv(stateTotalsUrl),
        d3.csv(totalStateUrl),
        d3.csv(stateTrendUrl),
        d3.csv(diseaseTrendUrl),
        d3.json(usUrl)
      ]);
    } catch (err) {
      // Provide a clearer error message for the caller
      const e = new Error(`Failed to load remote datasets. Please check network and URLs. Details: ${err.message}`);
      e.cause = err;
      throw e;
    }

    // Basic validation
    if (!Array.isArray(Death) || Death.length === 0) {
      const e = new Error(`Loaded Death CSV is empty or invalid from: ${deathUrl}`);
      throw e;
    }
    if (!Array.isArray(Cause) || Cause.length === 0) {
      const e = new Error(`Loaded Cause CSV is empty or invalid from: ${causeUrl}`);
      throw e;
    }
    if (!Array.isArray(stateTotals) || stateTotals.length === 0) {
      throw new Error(`Loaded state totals CSV is empty or invalid from: ${stateTotalsUrl}`);
    }
    if (!Array.isArray(totalState) || totalState.length === 0) {
      throw new Error(`Loaded cause-state totals CSV is empty or invalid from: ${totalStateUrl}`);
    }
    if (!Array.isArray(stateTrend) || stateTrend.length === 0) {
      throw new Error(`Loaded state trend CSV is empty or invalid from: ${stateTrendUrl}`);
    }
    if (!Array.isArray(diseaseTrend) || diseaseTrend.length === 0) {
      throw new Error(`Loaded disease trend CSV is empty or invalid from: ${diseaseTrendUrl}`);
    }

    function computeCrudeRate(deaths, population, rawRate) {
      if (Number.isFinite(rawRate)) return rawRate;
      if (!population) return NaN;
      return (deaths / population) * 100000;
    }

    const LAG_TEXT = "data not shown due to 6 month lag";

    const deathData = Death.map(d => {
      const causeLabel = d["UCD - ICD Chapter"] || "";
      // Drop suppressed/lagged cause rows from visualizations
      if (causeLabel.toLowerCase().includes(LAG_TEXT)) return null;
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      const deaths = +d["Deaths"] || 0;
      const population = +d["Population"] || 0;
      const rate = computeCrudeRate(deaths, population, rateParsed);
      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        cause: causeLabel,
        causeCode: d["UCD - ICD Chapter Code"],
        sex: d["Sex"],
        race: d["Single Race 6"],
        deaths,
        population,
        rate
      };
    }).filter(Boolean);

    const stateTotalsData = stateTotals.map(d => {
      const deaths = +d.Deaths || 0;
      const population = +d.Population || 0;
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        deaths,
        population,
        rate: computeCrudeRate(deaths, population, rateParsed)
      };
    });

    const causeTotalsByState = totalState.map(d => {
      const causeLabel = d["UCD - ICD Chapter"] || "";
      if (causeLabel.toLowerCase().includes(LAG_TEXT)) return null;
      const deaths = +d.Deaths || 0;
      const population = +d.Population || 0;
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        cause: causeLabel,
        causeCode: d["UCD - ICD Chapter Code"],
        deaths,
        population,
        rate: computeCrudeRate(deaths, population, rateParsed)
      };
    }).filter(Boolean);

    const stateTrends = stateTrend.map(d => {
      const deaths = +d.Deaths || 0;
      const population = +d.Population || 0;
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      const year = +d.Year || +d["Year Code"] || null;
      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        year,
        yearLabel: d.Year || d["Year Code"],
        deaths,
        population,
        rate: computeCrudeRate(deaths, population, rateParsed)
      };
    }).filter(d => d.year);

    const diseaseTrends = diseaseTrend.map(d => {
      const chapter = d["UCD - ICD Chapter"] || "";
      if (chapter.toLowerCase().includes(LAG_TEXT)) return null;
      const deaths = +d.Deaths || 0;
      const population = +d.Population || 0;
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      const year = +d.Year || +d["Year Code"] || null;
      return {
        chapter,
        chapterCode: d["UCD - ICD Chapter Code"],
        year,
        yearLabel: d.Year || d["Year Code"],
        deaths,
        population,
        rate: computeCrudeRate(deaths, population, rateParsed)
      };
    }).filter(d => d && d.year);

    const filteredCause = (Cause || []).filter(row => {
      const label = (row["UCD - ICD Chapter"] || "").toLowerCase();
      return !label.includes(LAG_TEXT);
    });

    return { deathData, Cause: filteredCause, us, stateTotals: stateTotalsData, causeTotalsByState, stateTrends, diseaseTrends };
  };
})();
