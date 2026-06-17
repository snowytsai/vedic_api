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

import {
  buildNatalPlanetsForPersonalAstrology,
  buildPersonalTransitPackage,
} from "./services/personalAstrologyEvents.js";

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
