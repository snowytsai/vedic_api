import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { cleanOldFiles } from "./services/cacheCleaner.js";
import {
  buildVedicChart,
  buildLifePeriods,
} from "./services/vedicChartService.js";

import {
  buildLiteChart,
  buildPlanetStatus,
  buildDashaSummary,
  buildTransitSummary,
} from "./utils/chartFormatter.js";

import {
  buildCurrentTransits,
  buildCollectiveWeekly,
  buildCollectiveMonthly,
  buildCollectiveYearly,
  buildCollectiveThreeYear,
  buildCollectiveTenYear,
} from "./services/collectiveAstrologyService.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
});

app.use("/api", limiter);

function getDateStr(dateParam) {
  if (dateParam) return dateParam;
  return new Date().toISOString().slice(0, 10);
}

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


// =========================
// API
// =========================

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/vedic/chart", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const chart = await buildVedicChart(dateStr, time, lat, lon);

    res.json({ ok: true, chart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "chart failed" });
  }
});

app.get("/api/vedic/chart-lite", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const chart = await buildVedicChart(dateStr, time, lat, lon);

    res.json({ ok: true, chart: buildLiteChart(chart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "chart-lite failed" });
  }
});

app.get("/api/vedic/planet-status", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const chart = await buildVedicChart(dateStr, time, lat, lon);

    res.json({ ok: true, planets: buildPlanetStatus(chart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "planet-status failed" });
  }
});

app.get("/api/vedic/dasha", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const chart = await buildVedicChart(dateStr, time, lat, lon);

    res.json({ ok: true, dasha: buildDashaSummary(chart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "dasha failed" });
  }
});

// 人生階段：幾歲到幾歲進入哪個 Mahadasha
app.get("/api/vedic/life-periods", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const chart = await buildVedicChart(dateStr, time, lat, lon);

    const periods = buildLifePeriods(dateStr, chart.dasha);

    res.json({
      ok: true,
      birth: {
        date: dateStr,
        time: time || null,
        lat: lat != null ? Number(lat) : null,
        lon: lon != null ? Number(lon) : null,
      },
      life_periods: periods,
      current: chart.dasha?.current || null,
      current_antardasha: chart.dasha?.current_antardasha || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: "life-periods failed",
    });
  }
});

app.get("/api/vedic/transit", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const natal = await buildVedicChart(dateStr, time, lat, lon);

    const today = new Date().toISOString().slice(0, 10);
    const transitChart = await buildVedicChart(today, time, lat, lon);

    res.json({
      ok: true,
      transit: buildTransitSummary(natal, transitChart),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "transit failed" });
  }
});

app.get("/api/vedic/yearly-forecast", async (req, res) => {
  try {
    const { date, time, lat, lon, year } = req.query;

    if (!date || !time || !lat || !lon) {
      return res.status(400).json({
        ok: false,
        error: "缺少 date/time/lat/lon",
      });
    }

    const targetYear = Number(year || new Date().getFullYear());

    const natal = await buildVedicChart(date, time, lat, lon);
    const natalLite = buildLiteChart(natal);
    const dasha = buildDashaSummary(natal);

    const months = [];

    for (let i = 1; i <= 12; i++) {
      const month = String(i).padStart(2, "0");
      const transitDate = `${targetYear}-${month}-15`;

      const transitChart = await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

      const transitSummary = buildTransitSummary(natal, transitChart);

      const personalTransit = buildPersonalTransitPackage(
        natal,
        transitChart,
        transitSummary
      );

      months.push({
        month: i,
        label: `${i} 月`,
        transit_date: transitDate,
        date: transitDate,
        ...personalTransit,
      });
    }

    return res.json({
      ok: true,
      forecast: {
        year: targetYear,
        birth: {
          date,
          time,
          lat: Number(lat),
          lon: Number(lon),
        },
        natal: natalLite,
        natal_planets: buildNatalPlanetsForPersonalAstrology(natal),
        dasha,
        annual_theme:
          "此年度流年根據個人本命盤、大運資料，以及每月代表日的行運盤產生。實際年度解讀會由 AI 依據這些個人化資料分析。",
        months,
      },
    });
  } catch (error) {
    console.error("yearly-forecast error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "年度流年計算失敗",
    });
  }
});

app.get("/api/vedic/three-year-forecast", async (req, res) => {
  try {
    const { date, time, lat, lon, startYear } = req.query;

    if (!date || !time || !lat || !lon) {
      return res.status(400).json({
        ok: false,
        error: "缺少 date/time/lat/lon",
      });
    }

    const firstYear = Number(startYear || new Date().getFullYear());
    const endYear = firstYear + 2;

    const natal = await buildVedicChart(date, time, lat, lon);
    const natalLite = buildLiteChart(natal);
    const dasha = buildDashaSummary(natal);

    const periods = [];

    for (let y = firstYear; y <= endYear; y++) {
      for (let q = 1; q <= 4; q++) {
        let month = "02";

        if (q === 2) month = "05";
        if (q === 3) month = "08";
        if (q === 4) month = "11";

        const transitDate = `${y}-${month}-15`;

        const transitChart = await buildVedicChart(
          transitDate,
          time,
          lat,
          lon
        );

        const transitSummary = buildTransitSummary(natal, transitChart);

        const personalTransit = buildPersonalTransitPackage(
          natal,
          transitChart,
          transitSummary
        );

        periods.push({
          year: y,
          quarter: `Q${q}`,
          label: `第 ${q} 季`,
          transit_date: transitDate,
          date: transitDate,
          ...personalTransit,
        });
      }
    }

    return res.json({
      ok: true,
      forecast: {
        start_year: firstYear,
        end_year: endYear,
        birth: {
          date,
          time,
          lat: Number(lat),
          lon: Number(lon),
        },
        natal: natalLite,
        natal_planets: buildNatalPlanetsForPersonalAstrology(natal),
        dasha,
        three_year_theme:
          "此三年流年根據個人本命盤、大運資料，以及每季代表日的行運盤產生。AI 會根據這些資料分析未來三年的重要變化。",
        periods,
      },
    });
  } catch (error) {
    console.error("three-year-forecast error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "三年流年計算失敗",
    });
  }
});

app.get("/api/vedic/ten-year-forecast", async (req, res) => {
  try {
    const { date, time, lat, lon, startYear } = req.query;

    if (!date || !time || !lat || !lon) {
      return res.status(400).json({
        ok: false,
        error: "缺少 date/time/lat/lon",
      });
    }

    const firstYear = Number(startYear || new Date().getFullYear());
    const endYear = firstYear + 9;

    const natal = await buildVedicChart(date, time, lat, lon);
    const natalLite = buildLiteChart(natal);
    const dasha = buildDashaSummary(natal);

    const years = [];

    for (let y = firstYear; y <= endYear; y++) {
      const transitDate = `${y}-07-02`;

      const transitChart = await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

      const transitSummary = buildTransitSummary(natal, transitChart);

      const personalTransit = buildPersonalTransitPackage(
        natal,
        transitChart,
        transitSummary
      );

      years.push({
        year: y,
        label: `${y}`,
        transit_date: transitDate,
        date: transitDate,
        ...personalTransit,
      });
    }

    return res.json({
      ok: true,
      forecast: {
        start_year: firstYear,
        end_year: endYear,
        birth: {
          date,
          time,
          lat: Number(lat),
          lon: Number(lon),
        },
        natal: natalLite,
        natal_planets: buildNatalPlanetsForPersonalAstrology(natal),
        dasha,
        ten_year_theme:
          "此十年流年根據個人本命盤、大運資料，以及每年代表日的行運盤產生。AI 會根據這些資料分析未來十年的長期人生變化。",
        years,
      },
    });
  } catch (error) {
    console.error("ten-year-forecast error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "十年流年計算失敗",
    });
  }
});

app.get("/api/vedic/debug", async (req, res) => {
  try {
    const dateStr = getDateStr(req.query.date);
    const { time, lat, lon } = req.query;

    const chart = await buildVedicChart(dateStr, time, lat, lon);

    console.log("===== DEBUG CHART =====");
    console.dir(chart, { depth: null });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "debug failed" });
  }
});

app.get("/api/vedic/weekly-fortune", async (req, res) => {
  try {
    const { date, time, lat, lon, startDate } = req.query;

    if (!date || !time || !lat || !lon) {
      return res.status(400).json({
        ok: false,
        error: "缺少 date/time/lat/lon",
      });
    }

    const natal = await buildVedicChart(date, time, lat, lon);
    const natalLite = buildLiteChart(natal);
    const dasha = buildDashaSummary(natal);

    const baseDate = startDate ? new Date(startDate) : new Date();

    const days = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);

      const transitDate = d.toISOString().slice(0, 10);

      const transitChart = await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

      const transitSummary = buildTransitSummary(natal, transitChart);

      const personalTransit = buildPersonalTransitPackage(
        natal,
        transitChart,
        transitSummary
      );

      days.push({
        day_index: i + 1,
        label: `第 ${i + 1} 天`,
        date: transitDate,
        ...personalTransit,
      });
    }

    return res.json({
      ok: true,
      forecast: {
        start_date: days[0]?.date || null,
        end_date: days[6]?.date || null,
        birth: {
          date,
          time,
          lat: Number(lat),
          lon: Number(lon),
        },
        natal: natalLite,
        natal_planets: buildNatalPlanetsForPersonalAstrology(natal),
        dasha,
        weekly_theme:
          "此本週運勢根據個人本命盤、大運資料，以及未來 7 天每日行運盤產生。AI 會根據這些資料分析本週的短期能量變化。",
        days,
      },
    });
  } catch (error) {
    console.error("weekly-fortune error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "本週運勢計算失敗",
    });
  }
});

app.get("/api/vedic/monthly-fortune", async (req, res) => {
  try {
    const { date, time, lat, lon, year, month } = req.query;

    if (!date || !time || !lat || !lon) {
      return res.status(400).json({
        ok: false,
        error: "缺少 date/time/lat/lon",
      });
    }

    const now = new Date();
    const targetYear = Number(year || now.getFullYear());
    const targetMonth = Number(month || now.getMonth() + 1);

    const natal = await buildVedicChart(date, time, lat, lon);
    const natalLite = buildLiteChart(natal);
    const dasha = buildDashaSummary(natal);

    const start = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const end = new Date(Date.UTC(targetYear, targetMonth, 0));

    const weeks = [];
    let weekIndex = 1;

    for (let day = 1; day <= end.getUTCDate(); day += 7) {
      const d = new Date(Date.UTC(targetYear, targetMonth - 1, day));
      const transitDate = d.toISOString().slice(0, 10);

      const transitChart = await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

      const transitSummary = buildTransitSummary(natal, transitChart);

      const personalTransit = buildPersonalTransitPackage(
        natal,
        transitChart,
        transitSummary
      );

      weeks.push({
        week_index: weekIndex,
        label: `第 ${weekIndex} 週`,
        date: transitDate,
        ...personalTransit,
      });

      weekIndex++;
    }

    return res.json({
      ok: true,
      forecast: {
        year: targetYear,
        month: targetMonth,
        month_label: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        birth: {
          date,
          time,
          lat: Number(lat),
          lon: Number(lon),
        },
        natal: natalLite,
        natal_planets: buildNatalPlanetsForPersonalAstrology(natal),
        dasha,
        monthly_theme:
          "此本月運勢根據個人本命盤、大運資料，以及當月每週代表日的行運盤產生。AI 會根據這些資料分析本月的重要短期變化。",
        weeks,
      },
    });
  } catch (error) {
    console.error("monthly-fortune error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "本月運勢計算失敗",
    });
  }
});

app.get("/api/vedic/current-transits", async (req, res) => {
  try {
    const data = await buildCurrentTransits(req.query);
    return res.json(data);
  } catch (error) {
    console.error("current-transits error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "current-transits failed",
    });
  }
});

app.get("/api/vedic/collective-weekly", async (req, res) => {
  try {
    const data = await buildCollectiveWeekly(req.query);
    return res.json(data);
  } catch (error) {
    console.error("collective-weekly error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "collective-weekly failed",
    });
  }
});

app.get("/api/vedic/collective-monthly", async (req, res) => {
  try {
    const data = await buildCollectiveMonthly(req.query);
    return res.json(data);
  } catch (error) {
    console.error("collective-monthly error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "collective-monthly failed",
    });
  }
});

app.get("/api/vedic/collective-yearly", async (req, res) => {
  try {
    const data = await buildCollectiveYearly(req.query);
    return res.json(data);
  } catch (error) {
    console.error("collective-yearly error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "collective-yearly failed",
    });
  }
});

app.get("/api/vedic/collective-three-year", async (req, res) => {
  try {
    const data = await buildCollectiveThreeYear(req.query);
    return res.json(data);
  } catch (error) {
    console.error("collective-three-year error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "collective-three-year failed",
    });
  }
});

app.get("/api/vedic/collective-ten-year", async (req, res) => {
  try {
    const data = await buildCollectiveTenYear(req.query);
    return res.json(data);
  } catch (error) {
    console.error("collective-ten-year error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "collective-ten-year failed",
    });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("vedic_api running");
  cleanOldFiles();
});
