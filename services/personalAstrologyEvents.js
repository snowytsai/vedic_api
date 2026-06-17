function normalizePlanetList(planets = []) {
  if (Array.isArray(planets)) return planets;
  if (planets && typeof planets === "object") return Object.values(planets);
  return [];
}

function planetKeyOf(p = {}) {
  const raw = String(p.key || p.id || p.name || "").toLowerCase();
  const map = {
    "太陽": "sun",
    "月亮": "moon",
    "水星": "mercury",
    "金星": "venus",
    "火星": "mars",
    "木星": "jupiter",
    "土星": "saturn",
    "羅喉": "rahu",
    "計都": "ketu",
  };
  return map[p.name] || raw;
}

function planetNameOf(p = {}) {
  const key = planetKeyOf(p);
  const map = {
    sun: "太陽",
    moon: "月亮",
    mercury: "水星",
    venus: "金星",
    mars: "火星",
    jupiter: "木星",
    saturn: "土星",
    rahu: "Rahu",
    ketu: "Ketu",
  };
  return p.name || map[key] || p.key || "行星";
}

function siderealLongitudeOf(p = {}) {
  if (p?.sidereal?.longitude != null) return Number(p.sidereal.longitude);
  if (p?.longitude != null) return Number(p.longitude);
  if (p?.sidereal_longitude != null) return Number(p.sidereal_longitude);
  return null;
}

function siderealSignOf(p = {}) {
  return p?.sidereal?.sign || p?.sign || p?.rasi || null;
}

function siderealDegreeOf(p = {}) {
  if (p?.sidereal?.degree != null) return p.sidereal.degree;
  if (p?.degree != null) return p.degree;
  const lon = siderealLongitudeOf(p);
  return lon == null ? null : Number((lon % 30).toFixed(2));
}

function circularDistance(a, b) {
  if (a == null || b == null) return null;
  let diff = Math.abs(Number(a) - Number(b));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function getPersonalAspect(distance) {
  if (distance == null || Number.isNaN(distance)) return null;

  const aspects = [
    { type: "conjunction", label: "合相", angle: 0, orb: 8 },
    { type: "opposition", label: "對分", angle: 180, orb: 8 },
    { type: "trine", label: "三分", angle: 120, orb: 7 },
    { type: "square", label: "四分", angle: 90, orb: 7 },
    { type: "sextile", label: "六合", angle: 60, orb: 5 },
  ];

  for (const aspect of aspects) {
    if (Math.abs(distance - aspect.angle) <= aspect.orb) {
      return {
        ...aspect,
        orb_delta: Number(Math.abs(distance - aspect.angle).toFixed(2)),
      };
    }
  }

  return null;
}

function personalAspectLevel(transitKey, natalKey, aspectType) {
  const heavy = ["saturn", "jupiter", "rahu", "ketu"];
  const personalCore = ["sun", "moon", "ascendant"];

  if (heavy.includes(transitKey) && personalCore.includes(natalKey)) {
    return "high";
  }

  if (
    heavy.includes(transitKey) &&
    ["conjunction", "opposition", "square"].includes(aspectType)
  ) {
    return "high";
  }

  if (["conjunction", "opposition", "square"].includes(aspectType)) {
    return "medium";
  }

  return "low";
}

function buildNatalPlanetsForPersonalAstrology(natalChart) {
  const natalPlanets = normalizePlanetList(natalChart?.planets || []);
  const result = {};

  natalPlanets.forEach((p) => {
    const key = planetKeyOf(p);
    if (!key) return;

    result[key] = {
      key,
      name: planetNameOf(p),
      sign: siderealSignOf(p),
      degree: siderealDegreeOf(p),
      longitude: siderealLongitudeOf(p),
      nakshatra: p?.nakshatra || null,
      house: p?.house || p?.house_from_asc || p?.house_from_ascendant || null,
    };
  });

  return result;
}

function buildTransitNatalAspects(natalChart, transitChart) {
  const natalPlanets = normalizePlanetList(natalChart?.planets || []);
  const transitPlanets = normalizePlanetList(transitChart?.planets || []);

  const transitKeys = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "rahu",
    "ketu",
  ];

  const natalKeys = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "rahu",
    "ketu",
  ];

  const aspects = [];

  transitPlanets.forEach((tp) => {
    const transitKey = planetKeyOf(tp);
    if (!transitKeys.includes(transitKey)) return;

    const transitLon = siderealLongitudeOf(tp);
    if (transitLon == null) return;

    natalPlanets.forEach((np) => {
      const natalKey = planetKeyOf(np);
      if (!natalKeys.includes(natalKey)) return;

      const natalLon = siderealLongitudeOf(np);
      if (natalLon == null) return;

      const distance = circularDistance(transitLon, natalLon);
      const aspect = getPersonalAspect(distance);
      if (!aspect) return;

      const transitName = planetNameOf(tp);
      const natalName = planetNameOf(np);
      const level = personalAspectLevel(transitKey, natalKey, aspect.type);

      aspects.push({
        type: "transit_natal_aspect",
        level,
        aspect: aspect.type,
        aspect_label: aspect.label,
        orb: aspect.orb_delta,
        distance: Number(distance.toFixed(2)),
        transit_planet: transitKey,
        transit_planet_name: transitName,
        natal_planet: natalKey,
        natal_planet_name: natalName,
        title: `${transitName}${aspect.label}本命${natalName}`,
        description: `${transitName}與本命${natalName}形成${aspect.label}，此時期會啟動本命盤中${natalName}相關的人格、關係與生命主題。`,
        transit: {
          sign: siderealSignOf(tp),
          degree: siderealDegreeOf(tp),
          longitude: transitLon,
          nakshatra: tp?.nakshatra || null,
        },
        natal: {
          sign: siderealSignOf(np),
          degree: siderealDegreeOf(np),
          longitude: natalLon,
          nakshatra: np?.nakshatra || null,
          house: np?.house || np?.house_from_asc || np?.house_from_ascendant || null,
        },
      });
    });
  });

  return aspects.sort((a, b) => {
    const levelRank = { high: 0, medium: 1, low: 2 };
    if (levelRank[a.level] !== levelRank[b.level]) {
      return levelRank[a.level] - levelRank[b.level];
    }
    return a.orb - b.orb;
  });
}

function buildTransitHouseLordAspects(transitNatalAspects = []) {
  return transitNatalAspects
    .filter((a) => a?.natal_planet && a?.natal_planet !== "rahu" && a?.natal_planet !== "ketu")
    .map((a) => ({
      ...a,
      type: "transit_house_lord_aspect",
      title: `${a.transit_planet_name}${a.aspect_label}本命${a.natal_planet_name}守護主題`,
      description: `${a.transit_planet_name}觸發本命${a.natal_planet_name}，代表它所守護的宮位主題也會被帶動。`,
    }))
    .slice(0, 12);
}

function buildImportantPersonalAstrology(transitNatalAspects = [], limit = 8) {
  return transitNatalAspects.slice(0, limit).map((a) => ({
    type: "important_personal_astrology",
    level: a.level,
    title: a.title,
    description: a.description,
    aspect: a.aspect,
    aspect_label: a.aspect_label,
    orb: a.orb,
    transit_planet: a.transit_planet,
    natal_planet: a.natal_planet,
    transit: a.transit,
    natal: a.natal,
  }));
}

function buildPersonalTransitPackage(natal, transitChart, transitSummary) {
  const transitNatalAspects = buildTransitNatalAspects(natal, transitChart);
  const transitHouseLordAspects = buildTransitHouseLordAspects(transitNatalAspects);
  const importantPersonalAstrology = buildImportantPersonalAstrology(transitNatalAspects);

  return {
    highlights: importantPersonalAstrology.map((e) => e.title),
    important_events: importantPersonalAstrology,
    important_personal_astrology: importantPersonalAstrology,
    transit_natal_aspects: transitNatalAspects,
    transit_house_lord_aspects: transitHouseLordAspects,
    natal_planets: buildNatalPlanetsForPersonalAstrology(natal),
    planets: transitSummary?.planets || {},
    natal_ascendant: transitSummary?.natal_ascendant || null,
  };
}


export {
  buildNatalPlanetsForPersonalAstrology,
  buildTransitNatalAspects,
  buildTransitHouseLordAspects,
  buildImportantPersonalAstrology,
  buildPersonalTransitPackage,
};
