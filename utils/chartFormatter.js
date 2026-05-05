// =========================
// Chart Formatter
// 給 App / GPT 使用的精簡輸出整理
// =========================

function roundDegree(value) {
  if (typeof value !== "number") return null;
  return Math.round(value * 100) / 100;
}

function getPlanet(chart, name) {
  return chart?.planets?.find(p => p.name === name) || null;
}

function formatPlanetBasic(planet) {
  if (!planet) return null;

  return {
    key: planet.key,
    name: planet.name,
    sign: planet.sidereal?.sign || null,
    degree: roundDegree(planet.sidereal?.degree),
    house: planet.house ?? null,
    nakshatra: planet.nakshatra?.name || null,
    navamsa: planet.navamsa?.sign || null,
    dignity: planet.dignity?.label || "一般",
    dignity_status: planet.dignity?.status || "neutral",
    retrograde: !!planet.retrograde,
    combust: !!planet.combust
  };
}

export function buildLiteChart(chart) {
  const sun = getPlanet(chart, "太陽");
  const moon = getPlanet(chart, "月亮");
  const mercury = getPlanet(chart, "水星");
  const venus = getPlanet(chart, "金星");
  const mars = getPlanet(chart, "火星");
  const jupiter = getPlanet(chart, "木星");
  const saturn = getPlanet(chart, "土星");
  const rahu = getPlanet(chart, "Rahu");
  const ketu = getPlanet(chart, "Ketu");

  return {
    ascendant: chart?.ascendant
      ? {
          sign: chart.ascendant.sign,
          degree: roundDegree(chart.ascendant.degree)
        }
      : null,

    main_planets: {
      sun: formatPlanetBasic(sun),
      moon: formatPlanetBasic(moon),
      mercury: formatPlanetBasic(mercury),
      venus: formatPlanetBasic(venus),
      mars: formatPlanetBasic(mars),
      jupiter: formatPlanetBasic(jupiter),
      saturn: formatPlanetBasic(saturn),
      rahu: formatPlanetBasic(rahu),
      ketu: formatPlanetBasic(ketu)
    },

    current_dasha: chart?.dasha
      ? {
          mahadasha: chart.dasha.current?.lord || null,
          mahadasha_start: chart.dasha.current?.start || null,
          mahadasha_end: chart.dasha.current?.end || null,
          antardasha: chart.dasha.current_antardasha?.lord || null,
          antardasha_start: chart.dasha.current_antardasha?.start || null,
          antardasha_end: chart.dasha.current_antardasha?.end || null
        }
      : null
  };
}

export function buildPlanetStatus(chart) {
  const planets = chart?.planets || [];

  return planets.map(p => {
    const tags = [];

    if (p.dignity?.label) tags.push(p.dignity.label);
    if (p.retrograde) tags.push("逆行");
    if (p.combust) tags.push("燒太陽");

    return {
      key: p.key,
      name: p.name,
      sign: p.sidereal?.sign || null,
      house: p.house ?? null,
      status_tags: tags,
      summary: `${p.name}在${p.sidereal?.sign || "未知星座"}，第${p.house ?? "未知"}宮，${tags.length ? tags.join("、") : "一般"}`
    };
  });
}

export function buildDashaSummary(chart) {
  const dasha = chart?.dasha;

  if (!dasha) {
    return null;
  }

  return {
    system: dasha.system,
    birth_dasha_lord: dasha.birth_dasha_lord,
    birth_dasha_balance_years:
      typeof dasha.birth_dasha_balance_years === "number"
        ? Math.round(dasha.birth_dasha_balance_years * 100) / 100
        : null,
    current: dasha.current
      ? {
          lord: dasha.current.lord,
          start: dasha.current.start,
          end: dasha.current.end
        }
      : null,
    current_antardasha: dasha.current_antardasha
      ? {
          lord: dasha.current_antardasha.lord,
          start: dasha.current_antardasha.start,
          end: dasha.current_antardasha.end
        }
      : null,
    moon_nakshatra: dasha.moon_nakshatra
      ? {
          name: dasha.moon_nakshatra.name,
          lord: dasha.moon_nakshatra.lord
        }
      : null
  };
}

export function buildTransitSummary(natal, transitChart) {
  const signs = [
    "牡羊座", "金牛座", "雙子座", "巨蟹座",
    "獅子座", "處女座", "天秤座", "天蠍座",
    "射手座", "摩羯座", "水瓶座", "雙魚座"
  ];

  const ascSign = natal?.ascendant?.sign;

  function getHouseFromNatalAsc(sign) {
    const ascIndex = signs.indexOf(ascSign);
    const planetIndex = signs.indexOf(sign);

    if (ascIndex === -1 || planetIndex === -1) return null;

    return ((planetIndex - ascIndex + 12) % 12) + 1;
  }

  function getTransitPlanet(name) {
    const p = transitChart?.planets?.find(x => x.name === name);
    if (!p) return null;

    return {
      name: p.name,
      sign: p.sidereal?.sign || null,
      degree: typeof p.sidereal?.degree === "number"
        ? Math.round(p.sidereal.degree * 100) / 100
        : null,
      house_from_natal_asc: getHouseFromNatalAsc(p.sidereal?.sign),
      nakshatra: p.nakshatra?.name || null,
      retrograde: !!p.retrograde,
      combust: !!p.combust
    };
  }

  const planets = {
    sun: getTransitPlanet("太陽"),
    moon: getTransitPlanet("月亮"),
    mercury: getTransitPlanet("水星"),
    venus: getTransitPlanet("金星"),
    mars: getTransitPlanet("火星"),
    jupiter: getTransitPlanet("木星"),
    saturn: getTransitPlanet("土星"),
    rahu: getTransitPlanet("Rahu"),
    ketu: getTransitPlanet("Ketu")
  };

  const highlights = [];

  if (planets.jupiter?.house_from_natal_asc) {
    highlights.push(`木星行運第${planets.jupiter.house_from_natal_asc}宮`);
  }

  if (planets.saturn?.house_from_natal_asc) {
    highlights.push(`土星行運第${planets.saturn.house_from_natal_asc}宮`);
  }

  if (planets.rahu?.house_from_natal_asc) {
    highlights.push(`Rahu行運第${planets.rahu.house_from_natal_asc}宮`);
  }

  if (planets.ketu?.house_from_natal_asc) {
    highlights.push(`Ketu行運第${planets.ketu.house_from_natal_asc}宮`);
  }

  return {
    natal_ascendant: natal?.ascendant || null,
    transit_date: new Date().toISOString().slice(0, 10),
    planets,
    highlights
  };
}