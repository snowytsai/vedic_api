import { PLANETS } from "../utils/planetMap.js";
import { fetchPlanetVector } from "./horizonsClient.js";
import { parseVectorRaw } from "./ephemerisParser.js";

// =========================
// 工具
// =========================

function normalizeDegree(deg) {
  return ((deg % 360) + 360) % 360;
}

const VEDIC_SIGNS = [
  "牡羊座", "金牛座", "雙子座", "巨蟹座",
  "獅子座", "處女座", "天秤座", "天蠍座",
  "射手座", "摩羯座", "水瓶座", "雙魚座"
];

const SIGN_LORDS = {
  "牡羊座": "火星",
  "金牛座": "金星",
  "雙子座": "水星",
  "巨蟹座": "月亮",
  "獅子座": "太陽",
  "處女座": "水星",
  "天秤座": "金星",
  "天蠍座": "火星",
  "射手座": "木星",
  "摩羯座": "土星",
  "水瓶座": "土星",
  "雙魚座": "木星"
};

const DIGNITY_TABLE = {
  "太陽": { exalted: "牡羊座", debilitated: "天秤座" },
  "月亮": { exalted: "金牛座", debilitated: "天蠍座" },
  "火星": { exalted: "摩羯座", debilitated: "巨蟹座" },
  "水星": { exalted: "處女座", debilitated: "雙魚座" },
  "木星": { exalted: "巨蟹座", debilitated: "摩羯座" },
  "金星": { exalted: "雙魚座", debilitated: "處女座" },
  "土星": { exalted: "天秤座", debilitated: "牡羊座" }
};

const NAKSHATRAS = [
  { name: "Ashwini", lord: "Ketu" },
  { name: "Bharani", lord: "Venus" },
  { name: "Krittika", lord: "Sun" },
  { name: "Rohini", lord: "Moon" },
  { name: "Mrigashira", lord: "Mars" },
  { name: "Ardra", lord: "Rahu" },
  { name: "Punarvasu", lord: "Jupiter" },
  { name: "Pushya", lord: "Saturn" },
  { name: "Ashlesha", lord: "Mercury" },
  { name: "Magha", lord: "Ketu" },
  { name: "Purva Phalguni", lord: "Venus" },
  { name: "Uttara Phalguni", lord: "Sun" },
  { name: "Hasta", lord: "Moon" },
  { name: "Chitra", lord: "Mars" },
  { name: "Swati", lord: "Rahu" },
  { name: "Vishakha", lord: "Jupiter" },
  { name: "Anuradha", lord: "Saturn" },
  { name: "Jyeshtha", lord: "Mercury" },
  { name: "Mula", lord: "Ketu" },
  { name: "Purva Ashadha", lord: "Venus" },
  { name: "Uttara Ashadha", lord: "Sun" },
  { name: "Shravana", lord: "Moon" },
  { name: "Dhanishta", lord: "Mars" },
  { name: "Shatabhisha", lord: "Rahu" },
  { name: "Purva Bhadrapada", lord: "Jupiter" },
  { name: "Uttara Bhadrapada", lord: "Saturn" },
  { name: "Revati", lord: "Mercury" }
];

const DASHA_SEQUENCE = [
  "Ketu", "Venus", "Sun", "Moon", "Mars",
  "Rahu", "Jupiter", "Saturn", "Mercury"
];

const DASHA_YEARS = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17
};

const COMBUST_ORB = {
  "月亮": 12,
  "水星": 14,
  "金星": 10,
  "火星": 8,
  "木星": 11,
  "土星": 15
};

function getAngularDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function isCombust(planet, sunLongitude) {
  if (planet.name === "太陽") return false;
  if (planet.name === "Rahu") return false;
  if (planet.name === "Ketu") return false;

  const orb = COMBUST_ORB[planet.name];
  if (!orb) return false;

  const distance = getAngularDistance(
    planet.sidereal.longitude,
    sunLongitude
  );

  return distance <= orb;
}

function isRetrograde(parsedVector) {
  if (!parsedVector) return false;
  if (typeof parsedVector.vx !== "number") return false;
  return parsedVector.vx < 0;
}

function getSignIndex(signName) {
  return VEDIC_SIGNS.indexOf(signName);
}

function getSignLord(signName) {
  return SIGN_LORDS[signName] || null;
}

function getHouseFromSigns(planetSign, ascSign) {
  const planetIndex = getSignIndex(planetSign);
  const ascIndex = getSignIndex(ascSign);

  if (planetIndex === -1 || ascIndex === -1) return null;

  return ((planetIndex - ascIndex + 12) % 12) + 1;
}

function getDrishtiOffsets(planetName) {
  if (planetName === "土星") return [3, 7, 10];
  if (planetName === "木星") return [5, 7, 9];
  if (planetName === "火星") return [4, 7, 8];
  return [7];
}

function calculateAspects(planet, houses) {
  if (!planet.house || !houses) return [];

  const offsets = getDrishtiOffsets(planet.name);

  return offsets.map(offset => {
    const targetHouse = ((planet.house - 1 + offset) % 12) + 1;
    const target = houses.find(h => h.house === targetHouse);

    return {
      type: `${offset}th`,
      house: targetHouse,
      sign: target?.sign || null
    };
  });
}

function getPlanetDignity(planetName, sign) {
  const table = DIGNITY_TABLE[planetName];

  if (!table) return { status: "neutral", label: "一般" };

  if (sign === table.exalted) return { status: "exalted", label: "擢升" };
  if (sign === table.debilitated) return { status: "debilitated", label: "失勢" };
  if (getSignLord(sign) === planetName) return { status: "own", label: "本位" };

  return { status: "neutral", label: "一般" };
}

function buildHouseLords(houses, planets) {
  if (!houses || !planets) return [];

  return houses.map(house => {
    const lordName = getSignLord(house.sign);
    const lordPlanet = planets.find(p => p.name === lordName);

    return {
      house: house.house,
      sign: house.sign,
      lord: lordName,
      lord_house: lordPlanet?.house ?? null
    };
  });
}

function getApproxLahiriAyanamsa(year) {
  return 24.1 + (year - 2025) * 0.01397;
}

function tropicalToSidereal(longitude, year) {
  return normalizeDegree(longitude - getApproxLahiriAyanamsa(year));
}

function degreeToVedicSign(longitude) {
  const normalized = normalizeDegree(longitude);
  const index = Math.floor(normalized / 30);

  return {
    sign: VEDIC_SIGNS[index],
    degree: normalized % 30
  };
}

function getNakshatra(longitude) {
  const size = 360 / 27;

  const index = Math.min(
    26,
    Math.floor(normalizeDegree(longitude) / size)
  );

  const nak = NAKSHATRAS[index];

  const start = index * size;
  const positionInNakshatra = normalizeDegree(longitude) - start;
  const progress = positionInNakshatra / size;

  return {
    name: nak.name,
    lord: nak.lord,
    index,
    progress
  };
}

function getNavamsaSign(longitude) {
  const normalized = normalizeDegree(longitude);
  const signIndex = Math.floor(normalized / 30);
  const degreeInSign = normalized % 30;

  const navamsaIndex = Math.floor(degreeInSign / (30 / 9));
  const navamsaSignIndex = (signIndex * 9 + navamsaIndex) % 12;

  return VEDIC_SIGNS[navamsaSignIndex];
}

function addYears(date, years) {
  const result = new Date(date);
  result.setTime(result.getTime() + years * 365.2425 * 24 * 60 * 60 * 1000);
  return result;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getBirthDate(dateStr, timeStr) {
  const safeTime = timeStr || "00:00";
  return new Date(`${dateStr}T${safeTime}:00Z`);
}

function buildAntardashaPeriods(mahadashaLord, mahaStart, mahaEnd) {
  const mahaYears = DASHA_YEARS[mahadashaLord];
  const startIndex = DASHA_SEQUENCE.indexOf(mahadashaLord);

  if (startIndex === -1 || !mahaYears) return [];

  const periods = [];
  let cursor = new Date(mahaStart);

  for (let i = 0; i < 9; i++) {
    const subLord = DASHA_SEQUENCE[(startIndex + i) % DASHA_SEQUENCE.length];
    const subYears = (mahaYears * DASHA_YEARS[subLord]) / 120;
    const next = addYears(cursor, subYears);

    periods.push({
      lord: subLord,
      years: subYears,
      start: formatDate(cursor),
      end: formatDate(next)
    });

    cursor = next;
  }

  return periods;
}

function buildVimshottariDasha(dateStr, timeStr, moonLongitude) {
  if (!dateStr || moonLongitude == null) return null;

  const birthDate = getBirthDate(dateStr, timeStr);
  const moonNakshatra = getNakshatra(moonLongitude);
  const startLord = moonNakshatra.lord;

  const startIndex = DASHA_SEQUENCE.indexOf(startLord);
  if (startIndex === -1) return null;

  const fullYears = DASHA_YEARS[startLord];
  const elapsedYears = fullYears * moonNakshatra.progress;
  const remainingYears = fullYears - elapsedYears;

  const periodStart = addYears(birthDate, -elapsedYears);
  const periodEnd = addYears(birthDate, remainingYears);

  const periods = [];

  periods.push({
    lord: startLord,
    years: fullYears,
    start: formatDate(periodStart),
    end: formatDate(periodEnd),
    is_birth_dasha: true,
    antardashas: buildAntardashaPeriods(startLord, periodStart, periodEnd)
  });

  let cursor = periodEnd;

  for (let i = 1; i < 18; i++) {
    const lord = DASHA_SEQUENCE[(startIndex + i) % DASHA_SEQUENCE.length];
    const years = DASHA_YEARS[lord];
    const next = addYears(cursor, years);

    periods.push({
      lord,
      years,
      start: formatDate(cursor),
      end: formatDate(next),
      is_birth_dasha: false,
      antardashas: buildAntardashaPeriods(lord, cursor, next)
    });

    cursor = next;
  }

  const now = new Date();

  const current = periods.find(p => {
    const start = new Date(`${p.start}T00:00:00Z`);
    const end = new Date(`${p.end}T00:00:00Z`);
    return now >= start && now < end;
  }) || null;

  const currentAntardasha = current?.antardashas?.find(p => {
    const start = new Date(`${p.start}T00:00:00Z`);
    const end = new Date(`${p.end}T00:00:00Z`);
    return now >= start && now < end;
  }) || null;

  return {
    system: "Vimshottari Dasha",
    total_years: 120,
    moon_nakshatra: moonNakshatra,
    birth_dasha_lord: startLord,
    birth_dasha_balance_years: remainingYears,
    current,
    current_antardasha: currentAntardasha,
    periods
  };
}

function getJulianDate(dateStr, timeStr) {
  const date = new Date(`${dateStr}T${timeStr}:00Z`);
  return date.getTime() / 86400000 + 2440587.5;
}

function getGMST(jd) {
  const T = (jd - 2451545.0) / 36525.0;

  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;

  return normalizeDegree(gmst);
}

function buildWholeSignHouses(ascendant) {
  if (!ascendant) return null;

  const ascIndex = getSignIndex(ascendant.sign);

  return Array.from({ length: 12 }, (_, i) => {
    const signIndex = (ascIndex + i) % 12;

    return {
      house: i + 1,
      sign: VEDIC_SIGNS[signIndex]
    };
  });
}

function calculateAscendant(dateStr, timeStr, lat, lon) {
  const jd = getJulianDate(dateStr, timeStr);
  const gmst = getGMST(jd);
  const lst = normalizeDegree(gmst + Number(lon));

  const obliquity = 23.4367 * Math.PI / 180;
  const latRad = Number(lat) * Math.PI / 180;
  const lstRad = lst * Math.PI / 180;

  const asc =
    Math.atan2(
      Math.sin(lstRad),
      Math.cos(lstRad) * Math.cos(obliquity) -
        Math.tan(latRad) * Math.sin(obliquity)
    ) * 180 / Math.PI;

  return normalizeDegree(asc);
}

// =========================
// 核心引擎
// =========================

export async function buildVedicChart(dateStr, time, lat, lon) {
  const year = Number(dateStr.slice(0, 4));

  let ascendant = null;

  if (time && lat && lon) {
    const tropicalAsc = calculateAscendant(dateStr, time, lat, lon);
    const siderealAsc = tropicalToSidereal(tropicalAsc, year);
    const sign = degreeToVedicSign(siderealAsc);

    ascendant = {
      sign: sign.sign,
      degree: sign.degree
    };
  }

  const planets = [];

  for (const planet of PLANETS) {
    const raw = await fetchPlanetVector(
  planet.command,
  dateStr
);
    const parsed = parseVectorRaw(raw);

    const retrograde = isRetrograde(parsed);

    const siderealLon = tropicalToSidereal(parsed.longitude, year);
    const vedic = degreeToVedicSign(siderealLon);

    planets.push({
      key: planet.key,
      name: planet.name,
      sidereal: {
        sign: vedic.sign,
        degree: vedic.degree,
        longitude: siderealLon
      },
      nakshatra: getNakshatra(siderealLon),
      navamsa: {
        sign: getNavamsaSign(siderealLon)
      },
      retrograde,
      combust: false
    });
  }

  const moon = planets.find(p => p.name === "月亮");

  if (moon) {
    const rahuLon = normalizeDegree(moon.sidereal.longitude + 180);
    const ketuLon = normalizeDegree(rahuLon + 180);

    const rahuSign = degreeToVedicSign(rahuLon);
    const ketuSign = degreeToVedicSign(ketuLon);

    planets.push({
      key: "rahu",
      name: "Rahu",
      sidereal: {
        sign: rahuSign.sign,
        degree: rahuSign.degree,
        longitude: rahuLon
      },
      nakshatra: getNakshatra(rahuLon),
      navamsa: {
        sign: getNavamsaSign(rahuLon)
      },
      retrograde: true,
      combust: false
    });

    planets.push({
      key: "ketu",
      name: "Ketu",
      sidereal: {
        sign: ketuSign.sign,
        degree: ketuSign.degree,
        longitude: ketuLon
      },
      nakshatra: getNakshatra(ketuLon),
      navamsa: {
        sign: getNavamsaSign(ketuLon)
      },
      retrograde: true,
      combust: false
    });
  }

  const houses = buildWholeSignHouses(ascendant);

  if (ascendant) {
    planets.forEach(p => {
      p.house = getHouseFromSigns(p.sidereal.sign, ascendant.sign);
      p.aspects = calculateAspects(p, houses);
      p.dignity = getPlanetDignity(p.name, p.sidereal.sign);
    });
  }

  const sun = planets.find(p => p.name === "太陽");

  if (sun) {
    planets.forEach(p => {
      p.combust = isCombust(p, sun.sidereal.longitude);
    });
  }

  const houseLords = buildHouseLords(houses, planets);
  const dasha = moon
    ? buildVimshottariDasha(dateStr, time, moon.sidereal.longitude)
    : null;

  return {
    ascendant,
    houses,
    house_lords: houseLords,
    planets,
    dasha
  };
}

function calculateAge(dateStr, targetDateStr) {
  const birth = new Date(`${dateStr}T00:00:00Z`);
  const target = new Date(`${targetDateStr}T00:00:00Z`);

  return Math.floor(
    (target - birth) / (365.2425 * 24 * 60 * 60 * 1000)
  );
}

export function buildLifePeriods(dateStr, dasha) {
  if (!dasha?.periods) return [];

  return dasha.periods.map(period => {
    const startAge = calculateAge(dateStr, period.start);
    const endAge = calculateAge(dateStr, period.end);

    return {
      lord: period.lord,
      start: period.start,
      end: period.end,
      start_age: startAge,
      end_age: endAge,
    };
  });
}
