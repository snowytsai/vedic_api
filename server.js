import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { cleanOldFiles } from "./services/cacheCleaner.js";
import { buildVedicChart } from "./services/vedicChartService.js";

import {
  buildLiteChart,
  buildPlanetStatus,
  buildDashaSummary,
  buildTransitSummary,
} from "./utils/chartFormatter.js";

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

      months.push({
        month: i,
        transit_date: transitDate,
        highlights: transitSummary.highlights || [],
        planets: transitSummary.planets || {},
        natal_ascendant: transitSummary.natal_ascendant || null,
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

app.listen(process.env.PORT || 3001, () => {
  console.log("vedic_api running");
  cleanOldFiles();
});
