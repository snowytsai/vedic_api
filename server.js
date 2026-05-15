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

    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;

      return {
        month,
        title: `${month} 月流年重點`,
        focus: _getMonthFocus(month),
        career: _getCareerHint(month),
        relationship: _getRelationshipHint(month),
        wealth: _getWealthHint(month),
        health: _getHealthHint(month),
        warning: _getWarningHint(month),
      };
    });

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
        annual_theme:
          "今年的重點在於重新整理人生方向，觀察大運與流年行星帶來的變化，適合穩定累積、調整節奏，並為未來幾年建立新的基礎。",
        months,
        notes: [
          "此年度流年資料可提供 GPT 進一步生成完整解讀。",
          "後續可再接入大運、次運、木星與土星流運，讓判斷更精準。",
        ],
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

function _getMonthFocus(month) {
  const list = [
    "重新開始與設定目標",
    "財務整理與價值感調整",
    "溝通、學習與短期計畫",
    "家庭、內在安全感與居住議題",
    "創作、感情與自我表達",
    "健康、工作節奏與日常秩序",
    "合作關係與伴侶互動",
    "深層轉化、壓力與資源整合",
    "進修、旅行與人生視野",
    "事業方向與社會定位",
    "人脈、團隊與未來願景",
    "休息、沉澱與靈性整理",
  ];
  return list[month - 1];
}

function _getCareerHint(month) {
  if ([1, 4, 10].includes(month)) return "適合設定新方向，確認職涯目標與工作責任。";
  if ([6, 9, 11].includes(month)) return "適合學習、合作與拓展新機會。";
  return "以穩定完成現有任務為主，避免過度分心。";
}

function _getRelationshipHint(month) {
  if ([5, 7, 11].includes(month)) return "感情與人際互動較活躍，適合溝通與建立連結。";
  if ([8, 12].includes(month)) return "容易想很多，關係中要避免壓抑或冷戰。";
  return "關係重點在於穩定陪伴與實際支持。";
}

function _getWealthHint(month) {
  if ([2, 8, 10].includes(month)) return "財務議題較明顯，適合檢查支出、投資與資源配置。";
  return "財運以穩定累積為主，不宜衝動消費。";
}

function _getHealthHint(month) {
  if ([6, 12].includes(month)) return "需要注意睡眠、壓力與免疫力，避免過勞。";
  return "維持固定作息與穩定節奏會比較有利。";
}

function _getWarningHint(month) {
  if ([3, 8, 12].includes(month)) return "避免情緒化決策，也要注意溝通誤會。";
  if ([2, 10].includes(month)) return "財務與工作壓力容易增加，要保留緩衝。";
  return "本月適合穩定推進，不宜急著做重大決定。";
}


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
