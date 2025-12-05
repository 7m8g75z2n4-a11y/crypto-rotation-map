"use client";

import { useEffect, useState } from "react";

type CoinDef = {
  id: string;
  symbol: string;
  name: string;
};

const COINS: CoinDef[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
];

type MarketEntry = {
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  history7d: number[];
};

type MarketMap = Record<string, MarketEntry>;

/* ------------ signal helpers ------------ */

function getSentiment(change: number | null): string {
  if (change === null || Number.isNaN(change)) return "Neutral";
  if (change > 3) return "Strong Bullish";
  if (change > 0.5) return "Bullish";
  if (change < -3) return "Strong Bearish";
  if (change < -0.5) return "Bearish";
  return "Neutral";
}

function getTrendLabel(change: number | null): string {
  if (change === null || Number.isNaN(change)) return "Unknown";
  if (change > 15) return "Strong Uptrend";
  if (change > 5) return "Uptrend";
  if (change < -15) return "Strong Downtrend";
  if (change < -5) return "Downtrend";
  return "Sideways";
}

function getTrendPhase(change: number | null): string {
  if (change === null || Number.isNaN(change)) return "Unknown";
  if (change > 20) return "Parabolic Uptrend";
  if (change > 10) return "Expansion Phase";
  if (change > 3) return "Early Uptrend";
  if (change < -20) return "Capitulation";
  if (change < -10) return "Sharp Downtrend";
  if (change < -3) return "Grinding Downtrend";
  return "Range / Compression";
}

function getAccelerationLabel(
  c24: number | null,
  c7: number | null
): string {
  if (c24 === null || Number.isNaN(c24) || c7 === null || Number.isNaN(c7)) {
    return "Stable";
  }
  const avg = c7 / 7;
  if (c24 > avg + 3) return "Short-term acceleration";
  if (c24 < avg - 3) return "Short-term deceleration";
  return "Stable vs recent trend";
}

function getTrendScore(change: number | null): number {
  if (change === null || Number.isNaN(change)) return 0;
  return change / 4;
}

function getMomentumScore(change: number | null): number {
  if (change === null || Number.isNaN(change)) return 0;
  return change / 3;
}

function getTrafficLight(score: number) {
  if (score >= 6) {
    return {
      label: "Green – Favorable rotation",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.18)",
      border: "rgba(34,197,94,0.6)",
    };
  }
  if (score <= -2) {
    return {
      label: "Red – High risk",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.18)",
      border: "rgba(239,68,68,0.6)",
    };
  }
  return {
    label: "Yellow – Neutral / wait",
    color: "#facc15",
    bg: "rgba(250,204,21,0.2)",
    border: "rgba(250,204,21,0.6)",
  };
}

function formatPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toFixed(2) + "%";
}

/* ------------ chart inside each card ------------ */

type CardChartProps = {
  values: number[];
  showLow?: boolean;
  showHigh?: boolean;
};

function CardChart({ values, showLow = true, showHigh = true }: CardChartProps) {
  if (!values || values.length === 0) return null;

  const width = 160;
  const height = 160;
  const paddingX = 10;
  const paddingY = 10;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const minIndex = values.indexOf(min);
  const maxIndex = values.indexOf(max);

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : innerWidth;

  const points = values.map((v, i) => {
    const x = paddingX + i * stepX;
    const norm = (v - min) / range;
    const y = height - (paddingY + norm * innerHeight);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? [
          `M${points[0].x},${height - paddingY}`,
          ...points.map((p) => `L${p.x},${p.y}`),
          `L${points[points.length - 1].x},${height - paddingY}`,
          "Z",
        ].join(" ")
      : "";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        background: "rgba(15,23,42,0.95)",
        borderRadius: 10,
        border: "1px solid rgba(148,163,184,0.6)",
      }}
    >
      <line
        x1={paddingX}
        y1={height / 2}
        x2={width - paddingX}
        y2={height / 2}
        stroke="rgba(148,163,184,0.25)"
        strokeWidth={0.6}
        strokeDasharray="4 4"
      />
      <path d={areaPath} fill="rgba(56,189,248,0.18)" stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {/* low/high markers */}
      {showLow && points[minIndex] && (
        <circle
          cx={points[minIndex].x}
          cy={points[minIndex].y}
          r={4}
          fill="#b91c1c"
          stroke="#fecaca"
          strokeWidth={1}
        />
      )}
      {showHigh && maxIndex !== minIndex && points[maxIndex] && (
        <circle
          cx={points[maxIndex].x}
          cy={points[maxIndex].y}
          r={4}
          fill="#16a34a"
          stroke="#bbf7d0"
          strokeWidth={1}
        />
      )}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill="#38bdf8"
        />
      )}
    </svg>
  );
}

/* ------------ main page ------------ */

export default function Page() {
  const [marketData, setMarketData] = useState<MarketMap | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>(
    COINS.map((c) => c.id)
  );

  // load visibility from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("crm_visible_ids");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((id: string) =>
          COINS.some((c) => c.id === id)
        );
        if (filtered.length > 0) {
          setVisibleIds(filtered);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // save visibility
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("crm_visible_ids", JSON.stringify(visibleIds));
    } catch {
      // ignore
    }
  }, [visibleIds]);

  // fetch prices + 7d history (sparkline) in a single call to avoid rate limits
  useEffect(() => {
    async function load() {
      try {
        const ids = COINS.map((c) => c.id).join(",");
        const url =
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd" +
          "&ids=" +
          ids +
          "&order=market_cap_desc&per_page=250&page=1&sparkline=true" +
          "&price_change_percentage=24h,7d";

        const res = await fetch(url);
        if (!res.ok) throw new Error("market data API not ok");
        const raw: any[] = await res.json();

        const map: MarketMap = {};
        for (const coin of raw) {
          const id = coin?.id as string | undefined;
          if (!id || !COINS.some((c) => c.id === id)) continue;

          const price = Number(coin?.current_price ?? NaN);
          const c24 = Number(
            coin?.price_change_percentage_24h_in_currency ??
              coin?.price_change_percentage_24h
          );
          const c7 = Number(
            coin?.price_change_percentage_7d_in_currency ??
              coin?.price_change_percentage_7d
          );

          const prices7d: number[] = Array.isArray(coin?.sparkline_in_7d?.price)
            ? coin.sparkline_in_7d.price
                .map((v: any) => Number(v))
                .filter((v: number) => !Number.isNaN(v))
            : [];

          map[coin.id] = {
            price: Number.isNaN(price) ? null : price,
            change24h: Number.isNaN(c24) ? null : c24,
            change7d: Number.isNaN(c7) ? null : c7,
            history7d: prices7d,
          };
        }

        setMarketData(map);
      } catch (err) {
        console.error("Failed to load market data", err);
        setMarketData({});
      }
    }

    load();
  }, []);

  if (!marketData) {
    return (
      <main
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#e5e7eb",
        }}
      >
        Loading market data…
      </main>
    );
  }

  const visibleCoins = COINS.filter((c) => visibleIds.includes(c.id));

  return (
    <main
      style={{
        maxWidth: "820px",
        margin: "0 auto",
        padding: "1.8rem 1rem 2.5rem",
        color: "#e5e7eb",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "2rem",
          marginBottom: "0.6rem",
          fontWeight: 700,
        }}
      >
        Crypto Rotation Map
      </h1>

      {/* visibility chips */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: "1.5rem",
          padding: "0.75rem",
          background: "rgba(15,23,42,0.7)",
          borderRadius: "0.75rem",
          border: "1px solid rgba(148,163,184,0.4)",
          fontSize: "0.8rem",
        }}
      >
        <span style={{ opacity: 0.8 }}>Visible coins:</span>
        {COINS.map((c) => {
          const active = visibleIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() =>
                setVisibleIds((prev) =>
                  active ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                )
              }
              style={{
                padding: "0.3rem 0.8rem",
                borderRadius: "999px",
                border: active
                  ? "1px solid rgba(56,189,248,0.9)"
                  : "1px solid rgba(148,163,184,0.7)",
                background: active ? "rgba(56,189,248,0.18)" : "#020617",
                color: "#e5e7eb",
                cursor: "pointer",
              }}
            >
              {c.symbol}
            </button>
          );
        })}
      </div>

      {/* cards */}
      {visibleCoins.length === 0 ? (
        <p
          style={{
            textAlign: "center",
            opacity: 0.75,
            fontSize: "0.9rem",
          }}
        >
          No coins selected. Use the filters above.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {visibleCoins.map((coin) => {
            const entry = marketData[coin.id];
            const price = entry?.price ?? null;
            const c24 = entry?.change24h ?? null;
            const c7 = entry?.change7d ?? null;
            const history = entry?.history7d ?? [];

            const trend = getTrendLabel(c7);
            const sentiment = getSentiment(c24);
            const phase = getTrendPhase(c7);
            const accel = getAccelerationLabel(c24, c7);

            const score =
              getTrendScore(c7) * 2 + getMomentumScore(c24);
            const light = getTrafficLight(score);

            const c24v = c24 ?? 0;
            const c7v = c7 ?? 0;

            let intensity = 0;
            if (c7 !== null && !Number.isNaN(c7)) {
              intensity = Math.max(-1, Math.min(1, c7 / 20));
            }
            const barWidth = `${Math.max(15, Math.abs(intensity) * 100)}%`;
            const barColor =
              intensity > 0
                ? "linear-gradient(to right,#16a34a,#4ade80)"
                : intensity < 0
                ? "linear-gradient(to right,#b91c1c,#f97373)"
                : "linear-gradient(to right,#64748b,#94a3b8)";

            return (
              <div
                key={coin.id}
                style={{
                  padding: "1.2rem",
                  borderRadius: "1rem",
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(148,163,184,0.35)",
                  boxShadow: "0 18px 45px rgba(15,23,42,0.8)",
                  fontSize: "0.94rem",
                }}
              >
                {/* header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.4rem",
                  }}
                >
                  <strong>{coin.name}</strong>
                  <span style={{ opacity: 0.7 }}>{coin.symbol}</span>
                </div>

                {/* chart */}
                <div
                  style={{
                    marginBottom: "0.7rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.8rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.78rem",
                      opacity: 0.8,
                    }}
                  >
                    7d price shape
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      gap: "0.4rem",
                    }}
                  >
                    <CardChart values={history} showLow={false} />
                    <CardChart values={history} showHigh={false} />
                    <CardChart values={history} />
                  </div>
                </div>

                {/* metrics */}
                <div style={{ marginBottom: "0.3rem" }}>
                  <span style={{ opacity: 0.7 }}>Price: </span>
                  <span>
                    {price !== null ? `$${price.toFixed(2)}` : "—"}
                  </span>
                </div>

                <div style={{ marginBottom: "0.3rem" }}>
                  <span style={{ opacity: 0.7 }}>24h: </span>
                  <span
                    style={{
                      color:
                        c24 === null
                          ? "#e5e7eb"
                          : c24v > 0
                          ? "#22c55e"
                          : c24v < 0
                          ? "#ef4444"
                          : "#e5e7eb",
                    }}
                  >
                    {formatPct(c24)}
                  </span>
                </div>

                <div style={{ marginBottom: "0.3rem" }}>
                  <span style={{ opacity: 0.7 }}>7d: </span>
                  <span
                    style={{
                      color:
                        c7 === null
                          ? "#e5e7eb"
                          : c7v > 0
                          ? "#22c55e"
                          : c7v < 0
                          ? "#ef4444"
                          : "#e5e7eb",
                    }}
                  >
                    {formatPct(c7)}
                  </span>
                </div>

                <div style={{ marginBottom: "0.3rem" }}>
                  <span style={{ opacity: 0.7 }}>Trend: </span>
                  <span>{trend}</span>
                </div>

                <div style={{ marginBottom: "0.3rem" }}>
                  <span style={{ opacity: 0.7 }}>Sentiment: </span>
                  <span>{sentiment}</span>
                </div>

                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={{ opacity: 0.7 }}>Rotation score: </span>
                  <span>{score.toFixed(1)}</span>
                </div>

                {/* traffic light & text */}
                <div
                  style={{
                    marginTop: "0.3rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid rgba(148,163,184,0.35)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-start",
                      padding: "0.18rem 0.6rem",
                      borderRadius: "999px",
                      border: `1px solid ${light.border}`,
                      background: light.bg,
                      color: light.color,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                    }}
                  >
                    {light.label}
                  </div>
                  <div style={{ fontSize: "0.82rem", opacity: 0.9 }}>
                    <div>
                      <span style={{ opacity: 0.8 }}>Trend phase: </span>
                      <span>{phase}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.8 }}>Short-term move: </span>
                      <span>{accel}</span>
                    </div>
                  </div>
                </div>

                {/* 7d strength bar */}
                <div
                  style={{
                    marginTop: "0.8rem",
                    paddingTop: "0.55rem",
                    borderTop: "1px dashed rgba(148,163,184,0.35)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.25rem",
                      fontSize: "0.78rem",
                    }}
                  >
                    <span>7d strength</span>
                    <span>{c7 !== null ? c7.toFixed(1) + "%" : "—"}</span>
                  </div>
                  <div
                    style={{
                      height: "10px",
                      width: "100%",
                      borderRadius: "999px",
                      background: "rgba(15,23,42,0.9)",
                      border: "1px solid rgba(148,163,184,0.6)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: barWidth,
                        background: barColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
