"use client";
// Mini sparkline chart
function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length === 0) return null;

  const width = 220;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerHeight = height - 8;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const norm = (v - min) / range;
    const y = height - (norm * innerHeight + 4);
    return { x, y };
  });

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        background: "rgba(15,23,42,0.9)",
        borderRadius: 6,
        border: "1px solid rgba(148,163,184,0.7)",
      }}
    >
      <path
        d={d}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

import { useEffect, useState } from "react";

type CoinDef = {
  id: string;
  symbol: string;
  name: string;
};

const COINS: CoinDef[] = [
  { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
  { id: "ethereum", symbol: "eth", name: "Ethereum" },
  { id: "solana", symbol: "sol", name: "Solana" },
  { id: "chainlink", symbol: "link", name: "Chainlink" },
  { id: "avalanche-2", symbol: "avax", name: "Avalanche" },
];

type MarketEntry = {
  price: number | null;
  change24h: number | null;
  change7d: number | null;
};

type MarketMap = Record<string, MarketEntry>;

/* -------- Signal helpers -------- */

function getSentiment(change24h: number | null): string {
  if (change24h === null || Number.isNaN(change24h)) return "Neutral";
  if (change24h > 3) return "Strong Bullish";
  if (change24h > 0.5) return "Bullish";
  if (change24h < -3) return "Strong Bearish";
  if (change24h < -0.5) return "Bearish";
  return "Neutral";
}

function getTrendLabel(change7d: number | null): string {
  if (change7d === null || Number.isNaN(change7d)) return "Unknown";
  if (change7d > 15) return "Strong Uptrend";
  if (change7d > 5) return "Uptrend";
  if (change7d < -15) return "Strong Downtrend";
  if (change7d < -5) return "Downtrend";
  return "Sideways";
}

function getTrendPhase(change7d: number | null): string {
  if (change7d === null || Number.isNaN(change7d)) return "Unknown";

  if (change7d > 20) return "Parabolic Uptrend";
  if (change7d > 10) return "Expansion Phase";
  if (change7d > 3) return "Early Uptrend";

  if (change7d < -20) return "Capitulation";
  if (change7d < -10) return "Sharp Downtrend";
  if (change7d < -3) return "Grinding Downtrend";

  return "Range / Compression";
}

function getAccelerationLabel(
  change24h: number | null,
  change7d: number | null
): string {
  if (
    change24h === null ||
    Number.isNaN(change24h) ||
    change7d === null ||
    Number.isNaN(change7d)
  ) {
    return "No clear acceleration";
  }

  const dailyAvg = change7d / 7;

  if (change24h > dailyAvg + 3) return "Short-term acceleration";
  if (change24h < dailyAvg - 3) return "Short-term deceleration";

  return "Stable vs recent trend";
}

function getTrendScore(change7d: number | null): number {
  if (change7d === null || Number.isNaN(change7d)) return 0;
  return change7d / 4;
}

function getMomentumScore(change24h: number | null): number {
  if (change24h === null || Number.isNaN(change24h)) return 0;
  return change24h / 3;
}

function getTrafficLight(rotationScore: number) {
  if (rotationScore >= 6) {
    return {
      label: "Green – Favorable rotation",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.18)",
      border: "rgba(34,197,94,0.6)",
    };
  }
  if (rotationScore <= -2) {
    return {
      label: "Red – High risk / fading",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.6)",
    };
  }
  return {
    label: "Yellow – Neutral / wait",
    color: "#facc15",
    bg: "rgba(250,204,21,0.14)",
    border: "rgba(250,204,21,0.55)",
  };
}

function formatPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toFixed(2) + "%";
}

/* -------- Component -------- */

export default function Page() {
  const [marketData, setMarketData] = useState<MarketMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // which coins are visible (saved in localStorage)
  const [visibleIds, setVisibleIds] = useState<string[]>(
    COINS.map((c) => c.id)
  );

  // Load saved visibility from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("crm_visible_ids");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        setVisibleIds(parsed);
      }
    } catch (e) {
      console.warn("Failed to read saved filters", e);
    }
  }, []);

  // Save visibility when it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "crm_visible_ids",
        JSON.stringify(visibleIds)
      );
    } catch (e) {
      console.warn("Failed to save filters", e);
    }
  }, [visibleIds]);

  // Fetch market data
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const ids = COINS.map((c) => c.id).join(",");
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("API response not ok");

        const raw = await res.json();

        const map: MarketMap = {};
        for (const coin of COINS) {
          const entry = raw[coin.id];
          const price =
            typeof entry?.usd === "number"
              ? entry.usd
              : Number(entry?.usd ?? NaN);
          const change24h =
            typeof entry?.usd_24h_change === "number"
              ? entry.usd_24h_change
              : Number(entry?.usd_24h_change ?? NaN);

          // Fake 7d change for now (replace with real API later)
          const change7d = Math.round((Math.random() * 20 - 10) * 100) / 100;

          map[coin.id] = {
            price: Number.isNaN(price) ? null : price,
            change24h: Number.isNaN(change24h) ? null : change24h,
            change7d,
          };
        }

        setMarketData(map);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to load market data", err);
        setErrorMsg("Failed to load market data. Try refreshing.");
        setLoading(false);
      }
    }

    load();
  }, []);

  const visibleCoins = COINS.filter((c) => visibleIds.includes(c.id));

  if (loading || !marketData) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "2rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#e5e7eb",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ marginBottom: "0.75rem" }}>Crypto Rotation Map</h1>
          <p style={{ opacity: 0.8 }}>Loading market data…</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "1.6rem 1.2rem 2.5rem",
        maxWidth: "780px",
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      <h1
        style={{
          fontSize: "1.9rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "0.8rem",
        }}
      >
        Crypto Rotation Map
      </h1>

      <button
        onClick={() => window.location.reload()}
        style={{
          margin: "0 auto 1.1rem",
          display: "block",
          padding: "0.55rem 1.3rem",
          borderRadius: "999px",
          background: "rgba(37,99,235,0.18)",
          border: "1px solid rgba(37,99,235,0.7)",
          color: "#bfdbfe",
          fontSize: "0.9rem",
        }}
      >
        Refresh Data
      </button>

      {/* Coin filter chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          padding: "0.75rem",
          borderRadius: "0.75rem",
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(148,163,184,0.5)",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 500,
            marginRight: "0.5rem",
            color: "#e5e7eb",
            opacity: 0.8,
          }}
        >
          Visible coins:
        </span>

        {COINS.map((coin) => {
          const active = visibleIds.includes(coin.id);
          return (
            <button
              key={coin.id}
              onClick={() =>
                setVisibleIds((prev) =>
                  active
                    ? prev.filter((id) => id !== coin.id)
                    : [...prev, coin.id]
                )
              }
              style={{
                padding: "0.3rem 0.8rem",
                borderRadius: "999px",
                border: active
                  ? "1px solid rgba(56,189,248,0.9)"
                  : "1px solid rgba(148,163,184,0.7)",
                background: active
                  ? "rgba(56,189,248,0.18)"
                  : "#020617",
                color: "#e5e7eb",
                fontSize: "0.8rem",
                cursor: "pointer",
                opacity: active ? 1 : 0.8,
              }}
            >
              {coin.symbol.toUpperCase()}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <p
          style={{
            textAlign: "center",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            color: "#fecaca",
          }}
        >
          {errorMsg}
        </p>
      )}

      {visibleCoins.length === 0 ? (
        <p
          style={{
            textAlign: "center",
            opacity: 0.75,
            fontSize: "0.9rem",
          }}
        >
          No coins selected. Use the filters above to choose what to show.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "1.1rem",
          }}
        >
          {visibleCoins.map((coin) => {
            const entry = marketData[coin.id];

            const price = entry?.price ?? null;
            const change24h = entry?.change24h ?? null;
            const change7d = entry?.change7d ?? null;

            if (price === null || Number.isNaN(price)) {
              return (
                <div
                  key={coin.id}
                  style={{
                    background: "rgba(15,23,42,0.7)",
                    borderRadius: "1rem",
                    padding: "1.1rem",
                    border: "1px dashed rgba(148,163,184,0.4)",
                    opacity: 0.6,
                    fontSize: "0.9rem",
                  }}
                >
                  <div style={{ marginBottom: "0.4rem", fontWeight: 500 }}>
                    {coin.name}
                  </div>
                  <div style={{ opacity: 0.8 }}>Loading market data…</div>
                </div>
              );
            }

            const sentiment = getSentiment(change24h);
            const trendLabel = getTrendLabel(change7d);
            const trendScore = getTrendScore(change7d);
            const momentumScore = getMomentumScore(change24h);
            const rotationScore = trendScore * 2 + momentumScore;

            const trendPhase = getTrendPhase(change7d);
            const accelerationLabel = getAccelerationLabel(
              change24h,
              change7d
            );
            const traffic = getTrafficLight(rotationScore);

            // 7d bar intensity: map change7d into [-1, 1]
            let intensity = 0;
            if (change7d !== null && !Number.isNaN(change7d)) {
              intensity = Math.max(-1, Math.min(1, change7d / 20));
            }

            const barWidth = `${Math.max(15, Math.abs(intensity) * 100)}%`;
            const barColor =
              intensity > 0
                ? "linear-gradient(to right, #16a34a, #4ade80)"
                : intensity < 0
                ? "linear-gradient(to right, #b91c1c, #f97373)"
                : "linear-gradient(to right, #64748b, #94a3b8)";

            return (
              <div
                key={coin.id}
                style={{
                  background: "rgba(15,23,42,0.95)",
                  borderRadius: "1rem",
                  padding: "1.1rem",
                  border: "1px solid rgba(148,163,184,0.35)",
                  boxShadow: "0 18px 45px rgba(15,23,42,0.8)",
                  backdropFilter: "blur(10px)",
                  fontSize: "0.95rem",
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
                  <div style={{ fontWeight: 600 }}>{coin.name}</div>
                  <div style={{ opacity: 0.7 }}>
                    {coin.symbol.toUpperCase()}
                  </div>
                </div>

                {/* core metrics */}
                <div style={{ marginBottom: "0.4rem" }}>
                  <span style={{ opacity: 0.7 }}>Price: </span>
                  <span>${price.toFixed(2)}</span>
                </div>

                <div style={{ marginBottom: "0.4rem" }}>
                  <span style={{ opacity: 0.7 }}>24h: </span>
                  <span
                    style={{
                      color:
                        (change24h ?? 0) > 0
                          ? "#22c55e"
                          : (change24h ?? 0) < 0
                          ? "#ef4444"
                          : "#e5e7eb",
                    }}
                  >
                    {formatPct(change24h)}
                  </span>
                </div>

                <div style={{ marginBottom: "0.4rem" }}>
                  <span style={{ opacity: 0.7 }}>7d: </span>
                  <span
                    style={{
                      color:
                        (change7d ?? 0) > 0
                          ? "#22c55e"
                          : (change7d ?? 0) < 0
                          ? "#ef4444"
                          : "#e5e7eb",
                    }}
                  >
                    {formatPct(change7d)}
                  </span>
                </div>

                <div style={{ marginBottom: "0.4rem" }}>
                  <span style={{ opacity: 0.7 }}>Trend: </span>
                  <span>{trendLabel}</span>
                </div>

                <div style={{ marginBottom: "0.4rem" }}>
                  <span style={{ opacity: 0.7 }}>Sentiment: </span>
                  <span>{sentiment}</span>
                </div>

                <div style={{ marginBottom: "0.6rem" }}>
                  <span style={{ opacity: 0.7 }}>Rotation score: </span>
                  <span>{rotationScore.toFixed(1)}</span>
                </div>

                {/* signal summary */}
                <div
                  style={{
                    marginTop: "0.2rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid rgba(148,163,184,0.35)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  {/* traffic light chip */}
                  <div
                    style={{
                      alignSelf: "flex-start",
                      padding: "0.18rem 0.55rem",
                      borderRadius: "999px",
                      border: `1px solid ${traffic.border}`,
                      background: traffic.bg,
                      color: traffic.color,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                    }}
                  >
                    {traffic.label}
                  </div>

                  {/* text summary */}
                  <div style={{ fontSize: "0.82rem", opacity: 0.9 }}>
                    <div>
                      <span style={{ opacity: 0.8 }}>Trend phase: </span>
                      <span>{trendPhase}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.8 }}>Short-term move: </span>
                      <span>{accelerationLabel}</span>
                    </div>
                  </div>
                </div>

                {/* mini 7d bar chart */}
                <div
                  style={{
                    marginTop: "0.6rem",
                    paddingTop: "0.45rem",
                    borderTop: "1px dashed rgba(148,163,184,0.35)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.3rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.78rem",
                        opacity: 0.8,
                      }}
                    >
                      7d strength
                    </span>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        opacity: 0.75,
                      }}
                    >
                      {change7d !== null ? change7d.toFixed(1) + "%" : "—"}
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "10px",
                      borderRadius: "999px",
                      background: "rgba(15,23,42,0.9)",
                      border: "1px solid rgba(148,163,184,0.6)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: barWidth,
                        height: "100%",
                        background: barColor,
                        transition: "width 0.25s ease-out",
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
