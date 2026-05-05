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
  buildTransitSummary
} from "./utils/chartFormatter.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60
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

    // 本命盤
    const natal = await buildVedicChart(dateStr, time, lat, lon);

    // 今日行運盤
    const today = new Date().toISOString().slice(0, 10);
    const transitChart = await buildVedicChart(today, time, lat, lon);

    res.json({
      ok: true,
      transit: buildTransitSummary(natal, transitChart)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "transit failed" });
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