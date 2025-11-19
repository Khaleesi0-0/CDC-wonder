// data-loader.js
// Loads CSV/JSON datasets used by the site and normalizes field names.
(function () {
  window.loadMortalityData = async function () {
    // URLs from the user's repo
    // Use the standard raw.githubusercontent.com pattern: /<owner>/<repo>/<branch>/<path>
    const deathUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/MortalitybyRace.csv";
    const causeUrl = "https://raw.githubusercontent.com/Khaleesi0-0/CDC-wonder/main/Data/deathcause.csv";
    const usUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
    let Death, Cause, us;
    try {
      [Death, Cause, us] = await Promise.all([
        d3.csv(deathUrl),
        d3.csv(causeUrl),
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

    const deathData = Death.map(d => {
      const rateRaw = (d["Crude Rate"] ?? "").trim();
      const rate = rateRaw === "" || rateRaw.toLowerCase() === "unreliable" ? NaN : +rateRaw;

      return {
        state: d["Residence State"],
        stateFips: d["Residence State Code"]?.padStart(2, "0"),
        cause: d["UCD - ICD Chapter"],
        causeCode: d["UCD - ICD Chapter Code"],
        sex: d["Sex"],
        race: d["Single Race 6"],
        deaths: +d["Deaths"] || 0,
        population: +d["Population"] || 0,
        rate
      };
    });

    return { deathData, Cause, us };
  };
})();
