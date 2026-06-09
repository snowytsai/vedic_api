import { buildVedicChart } from "./vedicChartService.js";

import {
  buildLiteChart,
} from "../utils/chartFormatter.js";

import {
  buildMajorAstrologyEvents,
} from "./majorAstrologyEvents.js";

// ======================================
// Astrology Event Helpers
// ======================================

export function buildImportantAstrologyEvents(
  planets = [],
  mode = "daily"
) {
  const events = [];

  const planetList = Array.isArray(planets)
    ? planets
    : Object.values(planets);

  const sun = planetList.find(
    (p) =>
      p.name === "太陽" ||
      p.key === "sun"
  );

  const moon = planetList.find(
    (p) =>
      p.name === "月亮" ||
      p.key === "moon"
  );

  // ======================
  // 新月 / 滿月
  // ======================

  if (
    sun?.sidereal?.longitude != null &&
    moon?.sidereal?.longitude != null
  ) {
    let diff = Math.abs(
      sun.sidereal.longitude -
        moon.sidereal.longitude
    );

    if (diff > 180) {
      diff = 360 - diff;
    }

    if (diff <= 12) {
      events.push({
        type: "new_moon",
        level: "high",
        title: "新月",
        description:
          "新週期開始，適合設定新目標。",
      });
    }

    if (diff >= 168) {
      events.push({
        type: "full_moon",
        level: "high",
        title: "滿月",
        description:
          "情緒與事件容易來到高峰。",
      });
    }
  }

  // ======================
  // 逆行
  // ======================

  planetList.forEach((p) => {
    if (
      p?.key === "rahu" ||
      p?.key === "ketu"
    ) {
      return;
    }

    if (p?.retrograde) {
      events.push({
        type: "retrograde",
        level: "medium",
        title: `${p.name || p.key}逆行`,
        description:
          "適合回顧、修正與重新整理。",
      });
    }
  });

  // ======================
  // 擢升 / 失勢 / 本位
  // ======================

  planetList.forEach((p) => {
    if (
      p?.key === "rahu" ||
      p?.key === "ketu"
    ) {
      return;
    }

    const dignity =
      p?.dignity?.status;

    const name =
      p.name || p.key || "行星";

    if (dignity === "exalted") {
      events.push({
        type: "exalted",
        level: "high",
        title: `${name}擢升`,
        description:
          `${name}位於擢升位置，能量較容易發揮正向力量。`,
      });
    }

    if (dignity === "debilitated") {
      events.push({
        type: "debilitated",
        level: "high",
        title: `${name}失勢`,
        description:
          `${name}位於失勢位置，相關主題需要更多覺察與調整。`,
      });
    }

    if (dignity === "own") {
      events.push({
        type: "own_sign",
        level: "medium",
        title: `${name}本位`,
        description:
          `${name}回到自己的星座，能量較穩定且容易掌握。`,
      });
    }
  });

  // ======================
  // 日焚
  // ======================

  planetList.forEach((p) => {
    if (p?.combust) {
      events.push({
        type: "combust",
        level: "medium",
        title: `${p.name || p.key}日焚`,
        description:
          "行星能量受到太陽強烈影響。",
      });
    }
  });

  // ======================
  // 月亮宿
  // ======================

  if (moon?.nakshatra) {
    events.push({
      type: "nakshatra",
      level: "low",
      title: `月亮位於 ${
        moon.nakshatra?.name ||
        moon.nakshatra
      }`,
      description:
        `今日月亮能量受到 ${
          moon.nakshatra?.name ||
          moon.nakshatra
        } 影響。`,
    });
  }

  const aspectPairs =
    mode === "daily" ||
    mode === "weekly" ||
    mode === "monthly"
      ? [
          ["太陽", "月亮"],
          ["太陽", "水星"],
          ["太陽", "金星"],
          ["月亮", "水星"],
          ["月亮", "金星"],
          ["月亮", "火星"],
          ["水星", "金星"],
          ["水星", "火星"],
          ["金星", "火星"],
        ]
      : [
          ["木星", "土星"],
          ["木星", "Rahu"],
          ["木星", "Ketu"],
          ["土星", "Rahu"],
          ["土星", "Ketu"],
        ];

  function findByName(name) {
    return planetList.find(
      (p) => p.name === name
    );
  }

  function getAspect(diff) {
    if (diff <= 6) return "合相";
    if (Math.abs(diff - 60) <= 5)
      return "六合";
    if (Math.abs(diff - 90) <= 6)
      return "刑相";
    if (Math.abs(diff - 120) <= 6)
      return "拱相";
    if (Math.abs(diff - 180) <= 6)
      return "沖相";
    return null;
  }

  aspectPairs.forEach(([a, b]) => {
    const pa = findByName(a);
    const pb = findByName(b);

    if (
      pa?.sidereal?.longitude == null ||
      pb?.sidereal?.longitude == null
    ) {
      return;
    }

    let diff = Math.abs(
      pa.sidereal.longitude -
        pb.sidereal.longitude
    );

    if (diff > 180) {
      diff = 360 - diff;
    }

    const aspect =
      getAspect(diff);

    if (aspect) {
      events.push({
        type: "aspect",
        level:
          aspect === "合相" ||
          aspect === "沖相"
            ? "high"
            : "medium",

        title: `${a}與${b}${aspect}`,

        description:
          `${a}與${b}形成${aspect}，此期間相關主題較容易被放大。`,
      });
    }
  });

  return events;
}

export function buildHighlightsFromEvents(
  events = []
) {
  return events
    .slice(0, 5)
    .map((e) => e.title);
}

export function uniqueEvents(
  events = []
) {
  return [
    ...new Map(
      events.map((e) => [
        e.title,
        e,
      ])
    ).values(),
  ];
}


// ======================================
// Daily Collective
// ======================================

export async function buildCurrentTransits({
  time = "12:00",
  lat = 25.033,
  lon = 121.5654,
}) {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const chart =
    await buildVedicChart(
      today,
      time,
      lat,
      lon
    );

  const liteChart =
    buildLiteChart(chart);

  const rawPlanets =
    chart?.planets || [];

  const displayPlanets =
    liteChart?.main_planets || {};

  const importantEvents =
    buildImportantAstrologyEvents(
      rawPlanets,
      "daily"
    );

  return {
    ok: true,
    mode: "collective",
    date: today,

    location: {
      time,
      lat: Number(lat),
      lon: Number(lon),
    },

    transit: {
      planets: displayPlanets,

      important_events:
        importantEvents,

      highlights:
        buildHighlightsFromEvents(
          importantEvents
        ),

      ascendant:
        liteChart?.ascendant ||
        chart?.ascendant ||
        null,

      chart: liteChart,
    },
  };
}

// ======================================
// Weekly Collective
// ======================================

export async function buildCollectiveWeekly({
  time = "12:00",
  lat = 25.033,
  lon = 121.5654,
}) {
  const baseDate = new Date();

  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);

    d.setDate(
      baseDate.getDate() + i
    );

    const transitDate =
      d.toISOString().slice(0, 10);

    const chart =
      await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

    const liteChart =
      buildLiteChart(chart);

    const rawPlanets =
      chart?.planets || [];

    const displayPlanets =
      liteChart?.main_planets || {};

    const importantEvents =
      buildImportantAstrologyEvents(
        rawPlanets,
        "weekly"
      );

    days.push({
      day_index: i + 1,

      label: `第 ${i + 1} 天`,

      date: transitDate,

      planets: displayPlanets,

      important_events:
        importantEvents,

      highlights:
        buildHighlightsFromEvents(
          importantEvents
        ),

      ascendant:
        liteChart?.ascendant ||
        chart?.ascendant ||
        null,

      chart: liteChart,
    });
  }

  return {
    ok: true,
    mode: "collective_weekly",
    days,
  };
}

// ======================================
// Monthly Collective
// ======================================

export async function buildCollectiveMonthly({
  time = "12:00",
  lat = 25.033,
  lon = 121.5654,
}) {
  const now = new Date();

  const targetYear =
    now.getFullYear();

  const targetMonth =
    now.getMonth() + 1;

  const weeks = [];

  let previousPlanets = null;

  const majorAstrologyEvents = [];

  for (
    let day = 1;
    day <= 28;
    day += 7
  ) {
    const d = new Date(
      Date.UTC(
        targetYear,
        targetMonth - 1,
        day
      )
    );

    const transitDate =
      d.toISOString().slice(0, 10);

    const chart =
      await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

    const liteChart =
      buildLiteChart(chart);

    const rawPlanets =
      chart?.planets || [];

    const displayPlanets =
      liteChart?.main_planets || {};

    const baseEvents =
      buildImportantAstrologyEvents(
        rawPlanets,
        "monthly"
      );

    const majorEvents =
      buildMajorAstrologyEvents({
        currentPlanets:
          rawPlanets,
        previousPlanets,
        mode: "monthly",
      });

    const importantEvents = uniqueEvents([
      ...baseEvents,
      ...majorEvents,
    ]);

    majorAstrologyEvents.push(
      ...majorEvents
    );

    previousPlanets =
      rawPlanets;

    weeks.push({
      week_index:
        weeks.length + 1,

      label: `第 ${
        weeks.length + 1
      } 週`,

      date: transitDate,

      planets:
        displayPlanets,

      important_events:
        importantEvents,

      highlights:
        buildHighlightsFromEvents(
          importantEvents
        ),

      ascendant:
        liteChart?.ascendant ||
        chart?.ascendant ||
        null,

      chart: liteChart,
    });
  }

  return {
    ok: true,
    mode: "collective_monthly",

    year: targetYear,
    month: targetMonth,

    month_label:
      `${targetYear}-${String(
        targetMonth
      ).padStart(2, "0")}`,

    major_astrology_events:
      uniqueEvents(
        majorAstrologyEvents
      ),

    weeks,
  };
}

// ======================================
// Yearly Collective
// ======================================

export async function buildCollectiveYearly({
  time = "12:00",
  lat = 25.033,
  lon = 121.5654,
}) {
  const targetYear =
    new Date().getFullYear();

  const months = [];

  let previousPlanets = null;

  const majorAstrologyEvents = [];

  for (let i = 1; i <= 12; i++) {
    const month =
      String(i).padStart(2, "0");

    const transitDate =
      `${targetYear}-${month}-15`;

    const chart =
      await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

    const liteChart =
      buildLiteChart(chart);

    const rawPlanets =
      chart?.planets || [];

    const displayPlanets =
      liteChart?.main_planets || {};

    const baseEvents =
      buildImportantAstrologyEvents(
        rawPlanets,
        "yearly"
      );

    const majorEvents =
      buildMajorAstrologyEvents({
        currentPlanets:
          rawPlanets,
        previousPlanets,
        mode: "yearly",
      });

    const importantEvents = uniqueEvents([
      ...baseEvents,
      ...majorEvents,
    ]);

    majorAstrologyEvents.push(
      ...majorEvents
    );

    previousPlanets =
      rawPlanets;

    months.push({
      month: i,

      label: `${i} 月`,

      date: transitDate,

      planets:
        displayPlanets,

      important_events:
        importantEvents,

      highlights:
        buildHighlightsFromEvents(
          importantEvents
        ),

      ascendant:
        liteChart?.ascendant ||
        chart?.ascendant ||
        null,

      chart: liteChart,
    });
  }

  return {
    ok: true,
    mode: "collective_yearly",

    year: targetYear,

    major_astrology_events:
      uniqueEvents(
        majorAstrologyEvents
      ),

    months,
  };
}

// ======================================
// Three Year Collective
// ======================================

export async function buildCollectiveThreeYear({
  time = "12:00",
  lat = 25.033,
  lon = 121.5654,
}) {
  const startYear =
    new Date().getFullYear();

  const endYear =
    startYear + 2;

  const periods = [];

  let previousPlanets = null;

  const majorAstrologyEvents = [];

  for (
    let y = startYear;
    y <= endYear;
    y++
  ) {
    for (let q = 1; q <= 4; q++) {
      let month = "02";

      if (q === 2)
        month = "05";

      if (q === 3)
        month = "08";

      if (q === 4)
        month = "11";

      const transitDate =
        `${y}-${month}-15`;

      const chart =
        await buildVedicChart(
          transitDate,
          time,
          lat,
          lon
        );

      const liteChart =
        buildLiteChart(chart);

      const rawPlanets =
        chart?.planets || [];

      const displayPlanets =
        liteChart?.main_planets || {};

    const baseEvents =
      buildImportantAstrologyEvents(
        rawPlanets,
        "three_year"
      );

        const majorEvents =
          buildMajorAstrologyEvents({
            currentPlanets:
          rawPlanets,
        previousPlanets,
        mode: "three_year",
      });

    const importantEvents = uniqueEvents([
      ...baseEvents,
      ...majorEvents,
    ]);

      majorAstrologyEvents.push(
        ...majorEvents
      );

      previousPlanets =
        rawPlanets;

      periods.push({
        year: y,

        quarter: q,

        label: `${y} Q${q}`,

        date: transitDate,

        planets:
          displayPlanets,

        important_events:
          importantEvents,

        highlights:
          buildHighlightsFromEvents(
            importantEvents
          ),

        ascendant:
          liteChart?.ascendant ||
          chart?.ascendant ||
          null,

        chart: liteChart,
      });
    }
  }

  return {
    ok: true,
    mode:
      "collective_three_year",

    start_year:
      startYear,

    end_year:
      endYear,

    major_astrology_events:
      uniqueEvents(
        majorAstrologyEvents
      ),

    periods,
  };
}

// ======================================
// Ten Year Collective
// ======================================

export async function buildCollectiveTenYear({
  time = "12:00",
  lat = 25.033,
  lon = 121.5654,
}) {
  const startYear =
    new Date().getFullYear();

  const endYear =
    startYear + 9;

  const years = [];

  let previousPlanets = null;

  const majorAstrologyEvents = [];

  for (
    let y = startYear;
    y <= endYear;
    y++
  ) {
    const transitDate =
      `${y}-07-02`;

    const chart =
      await buildVedicChart(
        transitDate,
        time,
        lat,
        lon
      );

    const liteChart =
      buildLiteChart(chart);

    const rawPlanets =
      chart?.planets || [];

    const displayPlanets =
      liteChart?.main_planets || {};

    const baseEvents =
      buildImportantAstrologyEvents(
        rawPlanets,
        "ten_year"
      );

        const majorEvents =
          buildMajorAstrologyEvents({
            currentPlanets:
          rawPlanets,
        previousPlanets,
        mode: "ten_year",
      });

    const importantEvents = uniqueEvents([
      ...baseEvents,
      ...majorEvents,
    ]);

    majorAstrologyEvents.push(
      ...majorEvents
    );

    previousPlanets =
      rawPlanets;

    years.push({
      year: y,

      label: `${y}`,

      date: transitDate,

      planets:
        displayPlanets,

      important_events:
        importantEvents,

      highlights:
        buildHighlightsFromEvents(
          importantEvents
        ),

      ascendant:
        liteChart?.ascendant ||
        chart?.ascendant ||
        null,

      chart: liteChart,
    });
  }

  return {
    ok: true,
    mode:
      "collective_ten_year",

    start_year:
      startYear,

    end_year:
      endYear,

    major_astrology_events:
      uniqueEvents(
        majorAstrologyEvents
      ),

    years,
  };
}

