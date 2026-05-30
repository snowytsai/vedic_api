function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchPlanetVector(
  command,
  targetDate
) {
  const startDate = targetDate;

  const next = new Date(`${targetDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);

  const stopDate = next.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    format: "json",
    COMMAND: command,
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "VECTORS",
    CENTER: "500@399",
    START_TIME: startDate,
    STOP_TIME: stopDate,
    STEP_SIZE: "'1 d'",
    REF_PLANE: "ECLIPTIC",
    OUT_UNITS: "AU-D",
    VEC_TABLE: "3"
  });

  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;

  console.log("🌐 JPL URL:", url);

  let lastError;

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`JPL HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      console.log("✅ JPL success");

      return data.result || "";
    } catch (error) {
      lastError = error;

      console.error(`❌ JPL retry ${i + 1} failed:`, error?.message || error);

      if (i < 2) {
        await sleep(1500 * (i + 1));
      }
    }
  }

  throw lastError || new Error("Unknown JPL fetch error");
}
