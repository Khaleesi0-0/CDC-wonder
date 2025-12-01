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
    const usUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
    let Death, Cause, stateTotals, totalState, stateTrend, us;
    try {
      [Death, Cause, stateTotals, totalState, stateTrend, us] = await Promise.all([
        d3.csv(deathUrl),
        d3.csv(causeUrl),
        d3.csv(stateTotalsUrl),
        d3.csv(totalStateUrl),
        d3.csv(stateTrendUrl),
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

    function computeCrudeRate(deaths, population, rawRate) {
      if (Number.isFinite(rawRate)) return rawRate;
      if (!population) return NaN;
      return (deaths / population) * 100000;
    }

    const deathData = Death.map(d => {
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      const deaths = +d["Deaths"] || 0;
      const population = +d["Population"] || 0;
      const rate = computeCrudeRate(deaths, population, rateParsed);
      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        cause: d["UCD - ICD Chapter"],
        causeCode: d["UCD - ICD Chapter Code"],
        sex: d["Sex"],
        race: d["Single Race 6"],
        deaths,
        population,
        rate
      };
    });

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
      const deaths = +d.Deaths || 0;
      const population = +d.Population || 0;
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rateParsed = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;
      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        cause: d["UCD - ICD Chapter"],
        causeCode: d["UCD - ICD Chapter Code"],
        deaths,
        population,
        rate: computeCrudeRate(deaths, population, rateParsed)
      };
    });

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

    return { deathData, Cause, us, stateTotals: stateTotalsData, causeTotalsByState, stateTrends };
  };
})();
