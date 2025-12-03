"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [marketData, setMarketData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // List of coins you track
  const visibleCoins = [
    { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
    { id: "ethereum", symbol: "eth", name: "Ethereum" },
    { id: "solana", symbol: "sol", name: "Solana" },
    { id: "chainlink", symbol: "link", name: "Chainlink" },
    { id: "avalanche-2", symbol: "avax", name: "Avalanche" },
  ];

  // -----------------------------
  //   Fetch Market + Trend Data
  // -----------------------------
  useEffect(() => {
    async function load() {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${visibleCoins
          .map((c) => c.id)
          .join(",")}&vs_currencies=usd&include_24hr_change=true`;

        const res = await fetch(url);
        const data = await res.json();

        setMarketData(
          visibleCoins.reduce((acc, coin) => {
            acc[coin.id] = {
              price: data[coin.id]?.usd ?? null,
              change24h: data[coin.id]?.usd_24h_change ?? null,
            };
            return acc;
          }, {} as any)
        );

        // fake trend data for now until we add real API
        setTrendData(
          visibleCoins.reduce((acc, coin) => {
            acc[coin.id] = {
              change7d: (Math.random() * 10 - 5).toFixed(2),
            };
            return acc;
          }, {} as any)
        );

        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setLoading(false);
      }
    }
    load();
  }, []);

  // -----------------------------
  //   Signal helpers
  // -----------------------------
  function getSentiment(change: number | null) {
    if (change === null) return "Neutral";
    if (change > 2) return "Bullish";
    if (change < -2) return "Bearish";
    return "Neutral";
  }

  function getTrendLabel(price: number | null, trend: any) {
    if (price === null) return "Unknown";
    const c7 = trend?.change7d ?? 0;
    if (c7 > 5) return "Strong Uptrend";
    if (c7 > 0) return "Uptrend";
    if (c7 < -5) return "Strong Downtrend";
    if (c7 < 0) return "Downtrend";
    return "Flat";
  }

  function getTrendScore(price: number | null, trend: any) {
    if (price === null) return 0;
    const c7 = parseFloat(trend?.change7d ?? 0);
    return c7 / 2;
  }

  function getMomentumScore(change24h: number | null) {
    if (change24h === null) return 0;
    return change24h / 3;
  }

  // -----------------------------
  //   Loading Screen
  // -----------------------------
  if (loading || !marketData || !trendData) {
    return (
      <main
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "#e5e7eb",
        }}
      >
        <h1>Loading market data…</h1>
      </main>
    );
  }

  // -----------------------------
  //   MAIN UI
  // -----------------------------
  return (
    <main
      style={{
        padding: "1.5rem",
        maxWidth: "720px",
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      <h1
        style={{
          fontSize: "1.7rem",
          fontWeight: 700,
          marginBottom: "1.2rem",
          textAlign: "center",
        }}
      >
        Crypto Rotation Map
      </h1>

      <div
        style={{
          display: "grid",
          gap: "1rem",
        }}
      >
        {visibleCoins.map((coin) => {
          const md = marketData ? marketData[coin.id] : undefined;
          const trend = trendData ? trendData[coin.id] : undefined;

          const price = md?.price ?? null;
          const change24h = md?.change24h ?? null;

          // 🟦 SAFETY GUARD: prevents app crashes
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
          const trendLabel = getTrendLabel(price, trend);

          const trendScore = getTrendScore(price, trend);
          const momentumScore = getMomentumScore(change24h);
          const rotationScore = momentumScore + 2 * trendScore;

          const change7d =
            trend && trend.change7d
              ? parseFloat(trend.change7d)
              : null;

          // -----------------------------
          //   MAIN CARD
          // -----------------------------
          return (
            <div
              key={coin.id}
              style={{
                background: "rgba(15,23,42,0.9)",
                borderRadius: "1rem",
                padding: "1.1rem",
                border: "1px solid rgba(148,163,184,0.3)",
                boxShadow: "0 18px 45px rgba(15,23,42,0.8)",
                backdropFilter: "blur(10px)",
                fontSize: "0.95rem",
              }}
            >
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
                  {change24h !== null
                    ? change24h.toFixed(2) + "%"
                    : "—"}
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
                  {change7d !== null ? change7d.toFixed(2) + "%" : "—"}
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

              <div>
                <span style={{ opacity: 0.7 }}>Rotation score: </span>
                <span>{rotationScore.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
