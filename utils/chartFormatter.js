// =========================
// Chart Formatter
// 給 App / GPT 使用的精簡輸出整理
// =========================

function roundDegree(value) {
  if (typeof value !== "number") return null;
  return Math.round(value * 100) / 100;
}

function getNakshatraName(planet) {
  const n = planet?.nakshatra;

  if (typeof n === "string") return n;

  return (
    n?.name ||
    n?.nakshatra ||
    n?.nakshatra_name ||
    n?.nakshatraName ||
    n?.label ||
    planet?.nakshatra_name ||
    planet?.nakshatraName ||
    planet?.nakshatraLabel ||
    null
  );
}

function getPlanet(chart, name) {
  return chart?.planets?.find(p => p.name === name) || null;
}

function formatPlanetBasic(planet) {
  if (!planet) return null;

  const nakshatraName = getNakshatraName(planet);

  return {
    key: planet.key,
    name: planet.name,
    sign: planet.sidereal?.sign || null,
    degree: roundDegree(planet.sidereal?.degree),
    house: planet.house ?? null,
    nakshatra: nakshatraName,
    nakshatra_name: nakshatraName,
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
    if (p.combust) tags.push("日焚");

    const nakshatraName = getNakshatraName(p);

    return {
      key: p.key,
      name: p.name,
      sign: p.sidereal?.sign || null,
      house: p.house ?? null,
      nakshatra: nakshatraName,
      nakshatra_name: nakshatraName,
      status_tags: tags,
      summary: `${p.name}在${p.sidereal?.sign || "未知星座"}，第${p.house ?? "未知"}宮，${nakshatraName ? `Nakshatra：${nakshatraName}，` : ""}${tags.length ? tags.join("、") : "一般"}`
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
          name:
            dasha.moon_nakshatra.name ||
            dasha.moon_nakshatra.nakshatra ||
            dasha.moon_nakshatra.nakshatra_name ||
            null,
          lord: dasha.moon_nakshatra.lord || null
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

  function getLongitude(planet) {
    if (typeof planet?.sidereal?.longitude === "number") {
      return planet.sidereal.longitude;
    }

    const sign = planet?.sidereal?.sign;
    const degree = planet?.sidereal?.degree;
    const signIndex = signs.indexOf(sign);

    if (signIndex === -1 || typeof degree !== "number") return null;

    return signIndex * 30 + degree;
  }

  function normalizeDegree(value) {
    if (typeof value !== "number") return null;
    return ((value % 360) + 360) % 360;
  }

  function getAngularDistance(a, b) {
    if (typeof a !== "number" || typeof b !== "number") return null;

    const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
    return Math.min(diff, 360 - diff);
  }

  function getAspect(distance) {
    if (typeof distance !== "number") return null;

    const aspects = [
      { type: "conjunction", label: "合相", angle: 0, orb: 6 },
      { type: "opposition", label: "對分", angle: 180, orb: 6 },
      { type: "trine", label: "三分", angle: 120, orb: 5 },
      { type: "square", label: "四分", angle: 90, orb: 4 },
      { type: "sextile", label: "六合", angle: 60, orb: 3 }
    ];

    for (const aspect of aspects) {
      const orb = Math.abs(distance - aspect.angle);

      if (orb <= aspect.orb) {
        return {
          type: aspect.type,
          label: aspect.label,
          angle: aspect.angle,
          orb: roundDegree(orb)
        };
      }
    }

    return null;
  }

  function getTransitPlanet(name) {
    const p = transitChart?.planets?.find(x => x.name === name);
    if (!p) return null;

    const nakshatraName = getNakshatraName(p);

    return {
      key: p.key || null,
      name: p.name,
      sign: p.sidereal?.sign || null,
      degree: roundDegree(p.sidereal?.degree),
      longitude: getLongitude(p),
      house_from_natal_asc: getHouseFromNatalAsc(p.sidereal?.sign),
      nakshatra: nakshatraName,
      nakshatra_name: nakshatraName,
      retrograde: !!p.retrograde,
      combust: !!p.combust
    };
  }

  function getNatalPlanetBasic(name) {
    const p = natal?.planets?.find(x => x.name === name);
    if (!p) return null;

    const nakshatraName = getNakshatraName(p);

    return {
      key: p.key || null,
      name: p.name,
      sign: p.sidereal?.sign || null,
      degree: roundDegree(p.sidereal?.degree),
      longitude: getLongitude(p),
      house: p.house ?? null,
      nakshatra: nakshatraName,
      nakshatra_name: nakshatraName,
      navamsa: p.navamsa?.sign || null,
      dignity: p.dignity?.label || "一般",
      dignity_status: p.dignity?.status || "neutral",
      retrograde: !!p.retrograde,
      combust: !!p.combust
    };
  }

  function buildPersonalHighlight(key, planet) {
    if (!planet?.house_from_natal_asc) return null;

    const house = planet.house_from_natal_asc;
    const title = `${planet.name}行運第${house}宮`;

    const parts = [];

    if (planet.sign) {
      parts.push(`${planet.name}目前在${planet.sign}`);
    }

    if (typeof planet.degree === "number") {
      parts.push(`${planet.degree}°`);
    }

    if (planet.nakshatra_name) {
      parts.push(`Nakshatra：${planet.nakshatra_name}`);
    }

    parts.push(`從你的本命上升${ascSign || "未知上升"}看，落在第${house}宮`);

    if (planet.retrograde) {
      parts.push("目前為逆行狀態");
    }

    if (planet.combust) {
      parts.push("目前有日焚狀態");
    }

    const description = parts.join("，");

    return {
      key,
      planet: planet.name,
      title,
      description,
      summary: `${title}｜${description}`,
      house_from_natal_asc: house,
      sign: planet.sign,
      degree: planet.degree,
      longitude: planet.longitude,
      nakshatra: planet.nakshatra,
      nakshatra_name: planet.nakshatra_name,
      retrograde: planet.retrograde,
      combust: planet.combust
    };
  }

  function buildTransitNatalAspects() {
    const transitPlanetNames = [
      "太陽", "月亮", "水星", "金星", "火星",
      "木星", "土星", "Rahu", "Ketu"
    ];

    const natalPlanetNames = [
      "太陽", "月亮", "水星", "金星", "火星",
      "木星", "土星", "Rahu", "Ketu"
    ];

    const results = [];

    for (const transitName of transitPlanetNames) {
      const transit = planetsByName[transitName];
      if (typeof transit?.longitude !== "number") continue;

      for (const natalName of natalPlanetNames) {
        const natalPlanet = natalPlanetsByName[natalName];
        if (typeof natalPlanet?.longitude !== "number") continue;

        const distance = getAngularDistance(transit.longitude, natalPlanet.longitude);
        const aspect = getAspect(distance);

        if (!aspect) continue;

        const title = `${transit.name}${aspect.label}本命${natalPlanet.name}`;

        const descriptionParts = [
          `行運${transit.name}目前在${transit.sign || "未知星座"}${typeof transit.degree === "number" ? ` ${transit.degree}°` : ""}`,
          `你的本命${natalPlanet.name}在${natalPlanet.sign || "未知星座"}${typeof natalPlanet.degree === "number" ? ` ${natalPlanet.degree}°` : ""}`,
          `形成${aspect.label}`,
          `容許度${aspect.orb}°`
        ];

        if (transit.house_from_natal_asc) {
          descriptionParts.push(`行運星落在你的第${transit.house_from_natal_asc}宮`);
        }

        if (natalPlanet.house) {
          descriptionParts.push(`本命${natalPlanet.name}位於第${natalPlanet.house}宮`);
        }

        results.push({
          type: "transit_to_natal_planet",
          title,
          description: descriptionParts.join("，"),
          summary: `${title}｜${descriptionParts.join("，")}`,
          transit_planet: transit.name,
          natal_planet: natalPlanet.name,
          aspect: aspect.type,
          aspect_label: aspect.label,
          aspect_angle: aspect.angle,
          orb: aspect.orb,
          distance: roundDegree(distance),
          transit: {
            name: transit.name,
            sign: transit.sign,
            degree: transit.degree,
            longitude: transit.longitude,
            house_from_natal_asc: transit.house_from_natal_asc,
            nakshatra: transit.nakshatra_name,
            retrograde: transit.retrograde,
            combust: transit.combust
          },
          natal: {
            name: natalPlanet.name,
            sign: natalPlanet.sign,
            degree: natalPlanet.degree,
            longitude: natalPlanet.longitude,
            house: natalPlanet.house,
            nakshatra: natalPlanet.nakshatra_name,
            dignity: natalPlanet.dignity,
            dignity_status: natalPlanet.dignity_status
          },
          priority:
            getTransitPriority(transit.name) +
            getNatalPriority(natalPlanet.name) +
            getAspectPriority(aspect.type) -
            aspect.orb
        });
      }
    }

    return results.sort((a, b) => b.priority - a.priority);
  }

  function buildTransitHouseLordAspects(transitNatalAspects) {
    const houseLords = natal?.house_lords || [];
    if (!Array.isArray(houseLords) || !houseLords.length) return [];

    const results = [];

    for (const item of transitNatalAspects) {
      const matchedHouses = houseLords.filter(h => h.lord === item.natal_planet);

      for (const house of matchedHouses) {
        const title = `${item.transit_planet}${item.aspect_label}第${house.house}宮主${house.lord}`;

        const description = [
          `你的第${house.house}宮落在${house.sign || "未知星座"}`,
          `宮主星為${house.lord}`,
          `行運${item.transit_planet}目前與本命${house.lord}形成${item.aspect_label}`,
          `容許度${item.orb}°`
        ].join("，");

        results.push({
          type: "transit_to_house_lord",
          title,
          description,
          summary: `${title}｜${description}`,
          house: house.house,
          house_sign: house.sign || null,
          house_lord: house.lord,
          house_lord_natal_house: house.lord_house ?? null,
          transit_planet: item.transit_planet,
          natal_planet: item.natal_planet,
          aspect: item.aspect,
          aspect_label: item.aspect_label,
          orb: item.orb,
          source_aspect: item,
          priority: item.priority + getHousePriority(house.house)
        });
      }
    }

    return results.sort((a, b) => b.priority - a.priority);
  }

  function getTransitPriority(name) {
    const scores = {
      "土星": 20,
      "木星": 18,
      "Rahu": 17,
      "Ketu": 17,
      "火星": 12,
      "太陽": 9,
      "金星": 8,
      "水星": 8,
      "月亮": 5
    };

    return scores[name] || 0;
  }

  function getNatalPriority(name) {
    const scores = {
      "月亮": 18,
      "太陽": 16,
      "金星": 13,
      "火星": 13,
      "水星": 12,
      "木星": 12,
      "土星": 12,
      "Rahu": 10,
      "Ketu": 10
    };

    return scores[name] || 0;
  }

  function getAspectPriority(type) {
    const scores = {
      conjunction: 20,
      opposition: 17,
      trine: 13,
      square: 12,
      sextile: 8
    };

    return scores[type] || 0;
  }

  function getHousePriority(house) {
    const scores = {
      1: 18,
      2: 10,
      3: 8,
      4: 13,
      5: 13,
      6: 10,
      7: 16,
      8: 15,
      9: 14,
      10: 18,
      11: 12,
      12: 12
    };

    return scores[house] || 0;
  }

  function buildImportantPersonalAstrology({
    personalizedHighlights,
    transitNatalAspects,
    transitHouseLordAspects
  }) {
    const items = [];

    transitNatalAspects.slice(0, 6).forEach(item => {
      items.push({
        type: item.type,
        title: item.title,
        description: item.description,
        summary: item.summary,
        priority: item.priority,
        data: item
      });
    });

    transitHouseLordAspects.slice(0, 6).forEach(item => {
      items.push({
        type: item.type,
        title: item.title,
        description: item.description,
        summary: item.summary,
        priority: item.priority,
        data: item
      });
    });

    personalizedHighlights.forEach(item => {
      items.push({
        type: "transit_house_position",
        title: item.title,
        description: item.description,
        summary: item.summary,
        priority:
          getTransitPriority(item.planet) +
          getHousePriority(item.house_from_natal_asc),
        data: item
      });
    });

    const seen = new Set();

    return items
      .sort((a, b) => b.priority - a.priority)
      .filter(item => {
        const key = `${item.type}_${item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
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

  const natal_planets = {
    sun: getNatalPlanetBasic("太陽"),
    moon: getNatalPlanetBasic("月亮"),
    mercury: getNatalPlanetBasic("水星"),
    venus: getNatalPlanetBasic("金星"),
    mars: getNatalPlanetBasic("火星"),
    jupiter: getNatalPlanetBasic("木星"),
    saturn: getNatalPlanetBasic("土星"),
    rahu: getNatalPlanetBasic("Rahu"),
    ketu: getNatalPlanetBasic("Ketu")
  };

  const planetsByName = {
    "太陽": planets.sun,
    "月亮": planets.moon,
    "水星": planets.mercury,
    "金星": planets.venus,
    "火星": planets.mars,
    "木星": planets.jupiter,
    "土星": planets.saturn,
    "Rahu": planets.rahu,
    "Ketu": planets.ketu
  };

  const natalPlanetsByName = {
    "太陽": natal_planets.sun,
    "月亮": natal_planets.moon,
    "水星": natal_planets.mercury,
    "金星": natal_planets.venus,
    "火星": natal_planets.mars,
    "木星": natal_planets.jupiter,
    "土星": natal_planets.saturn,
    "Rahu": natal_planets.rahu,
    "Ketu": natal_planets.ketu
  };

  const personalized_highlights = [
    buildPersonalHighlight("jupiter", planets.jupiter),
    buildPersonalHighlight("saturn", planets.saturn),
    buildPersonalHighlight("rahu", planets.rahu),
    buildPersonalHighlight("ketu", planets.ketu)
  ].filter(Boolean);

  const transit_natal_aspects = buildTransitNatalAspects();

  const transit_house_lord_aspects =
    buildTransitHouseLordAspects(transit_natal_aspects);

  const important_personal_astrology = buildImportantPersonalAstrology({
    personalizedHighlights: personalized_highlights,
    transitNatalAspects: transit_natal_aspects,
    transitHouseLordAspects: transit_house_lord_aspects
  });

  return {
    natal_ascendant: natal?.ascendant || null,
    transit_date: new Date().toISOString().slice(0, 10),

    // 本命星盤資料：給 GPT / 後續週月年共用
    natal_planets,

    // 今日行運星盤資料
    planets,

    // 新版：基礎個人行運，保留
    personalized_highlights,

    // 新版：行運星 × 本命星體
    transit_natal_aspects,

    // 新版：行運星 × 本命宮主星
    transit_house_lord_aspects,

    // 新版：給 Flutter / GPT 優先使用的「重要個人星象」
    important_personal_astrology,

    // 新版備用別名，不是舊 highlights
    highlight_cards: personalized_highlights
  };
}
