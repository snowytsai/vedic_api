// services/majorAstrologyEvents.js

function getPlanetByKey(planets, key) {
  return planets.find(
    (p) =>
      p.key === key ||
      p.key?.toLowerCase() === key
  );
}

function getAspect(diff) {
  if (diff <= 6) return "合相";
  if (Math.abs(diff - 60) <= 5) return "六合";
  if (Math.abs(diff - 90) <= 6) return "四分";
  if (Math.abs(diff - 120) <= 6) return "三分";
  if (Math.abs(diff - 180) <= 6) return "對分";

  return null;
}

function angularDistance(a, b) {
  let diff = Math.abs(a - b);

  if (diff > 180) {
    diff = 360 - diff;
  }

  return diff;
}

const HEAVY_PLANETS = [
  "jupiter",
  "saturn",
  "rahu",
  "ketu",
];

// ======================
// 單日重要星象
// ======================

export function scanMajorAspects(
  planets,
  mode = "monthly"
) {
  const events = [];

  const pairs =
    mode === "monthly"
      ? [
          ["jupiter", "saturn"],
          ["jupiter", "rahu"],
          ["jupiter", "ketu"],
          ["saturn", "rahu"],
          ["saturn", "ketu"],

          ["venus", "mars"],
          ["venus", "jupiter"],
          ["mars", "jupiter"],

          ["mercury", "venus"],
          ["mercury", "mars"],
        ]
      : [
          ["jupiter", "saturn"],
          ["jupiter", "rahu"],
          ["jupiter", "ketu"],
          ["saturn", "rahu"],
          ["saturn", "ketu"],
        ];

  pairs.forEach(([a, b]) => {
    const pa = getPlanetByKey(planets, a);
    const pb = getPlanetByKey(planets, b);

    if (
      pa?.sidereal?.longitude == null ||
      pb?.sidereal?.longitude == null
    ) {
      return;
    }

    const distance = angularDistance(
      pa.sidereal.longitude,
      pb.sidereal.longitude
    );

    const aspect = getAspect(distance);

    if (!aspect) return;

    const weight =
      HEAVY_PLANETS.includes(a) ||
      HEAVY_PLANETS.includes(b)
        ? 5
        : 3;

    events.push({
      type: "major_aspect",
      level: "high",
      weight,
      title: `${pa.name}與${pb.name}${aspect}`,
      description: `${pa.name}與${pb.name}形成${aspect}。`,
    });
  });

  return events;
}

// ======================
// 換座
// ======================

export function scanSignChanges(
  currentPlanets,
  previousPlanets,
  mode = "monthly"
) {
  const events = [];

  if (!previousPlanets?.length) {
    return events;
  }

  const keys =
    mode === "monthly"
      ? [
          "jupiter",
          "saturn",
          "rahu",
          "ketu",
          "mars",
          "venus",
          "mercury",
        ]
      : [
          "jupiter",
          "saturn",
          "rahu",
          "ketu",
        ];

  keys.forEach((key) => {
    const current =
      getPlanetByKey(currentPlanets, key);

    const previous =
      getPlanetByKey(previousPlanets, key);

    if (!current || !previous) return;

    const currentSign =
      current.sidereal?.sign;

    const previousSign =
      previous.sidereal?.sign;

    if (
      currentSign &&
      previousSign &&
      currentSign !== previousSign
    ) {
      events.push({
        type: "sign_change",
        level: "high",
        weight: HEAVY_PLANETS.includes(key)
          ? 5
          : 3,
        title: `${current.name}進入${currentSign}`,
        description: `${current.name}從${previousSign}進入${currentSign}`,
      });
    }
  });

  return events;
}

// ======================
// 逆行切換
// ======================

export function scanRetrogradeChanges(
  currentPlanets,
  previousPlanets,
  mode = "monthly"
) {
  const events = [];

  if (!previousPlanets?.length) {
    return events;
  }

  const keys =
    mode === "monthly"
      ? [
          "jupiter",
          "saturn",
          "mars",
          "venus",
          "mercury",
        ]
      : [
          "jupiter",
          "saturn",
        ];

  keys.forEach((key) => {
    const current =
      getPlanetByKey(currentPlanets, key);

    const previous =
      getPlanetByKey(previousPlanets, key);

    if (!current || !previous) return;

    if (
      !previous.retrograde &&
      current.retrograde
    ) {
      events.push({
        type: "retrograde_start",
        level: "high",
        weight: 4,
        title: `${current.name}開始逆行`,
        description: `${current.name}由順行轉為逆行`,
      });
    }

    if (
      previous.retrograde &&
      !current.retrograde
    ) {
      events.push({
        type: "direct_start",
        level: "high",
        weight: 4,
        title: `${current.name}恢復順行`,
        description: `${current.name}由逆行轉為順行`,
      });
    }
  });

  return events;
}

// ======================
// 統一入口
// ======================

export function buildMajorAstrologyEvents({
  currentPlanets,
  previousPlanets,
  mode = "monthly",
}) {
  let events = [];

  events.push(
    ...scanSignChanges(
      currentPlanets,
      previousPlanets,
      mode
    )
  );

  events.push(
    ...scanRetrogradeChanges(
      currentPlanets,
      previousPlanets,
      mode
    )
  );

  events.push(
    ...scanMajorAspects(
      currentPlanets,
      mode
    )
  );

  events.sort(
    (a, b) =>
      (b.weight || 0) -
      (a.weight || 0)
  );

  if (mode === "yearly") {
    const major = events.filter(
      (e) => e.weight >= 5
    );

    const secondary = events
      .filter((e) => e.weight < 5)
      .slice(0, 10);

    return [...major, ...secondary];
  }

  if (
    mode === "three_year" ||
    mode === "ten_year"
  ) {
    return events.filter(
      (e) => e.weight >= 5
    );
  }

  return events;
}

