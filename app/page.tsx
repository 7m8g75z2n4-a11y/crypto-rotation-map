"use client";
import { useEffect, useState } from "react";

type Sector = "Macro" | "L1" | "Oracle";

type Coin = {
  id: string;
  symbol: string;
  name: string;
  sector: Sector;
};

type MarketData = {
  price: number | null;
  change24h: number | null;
};

type TrendInfo = {
  ema20: number;
  ema50: number;
  change7d: number | null;
  spark: number[]; // recent prices for sparkline
};

type RotationItem = {
  coin: Coin;
  score: number;
};

const SENTIMENT_RULES = {
  strongUp: 5,
  mildUp: 2,
  mildDown: -2,
  strongDown: -5,
};

// 👉 You can edit these sectors and coin sets anytime.
const COINS: Coin[] = [
  { id: "bitcoin",      symbol: "BTC",  name: "Bitcoin",  sector: "Macro"  },
  { id: "ethereum",     symbol: "ETH",  name: "Ethereum", sector: "L1"     },
  { id: "solana",       symbol: "SOL",  name: "Solana",   sector: "L1"     },
  { id: "chainlink",    symbol: "LINK", name: "Chainlink",sector: "Oracle" },
  { id: "avalanche-2",  symbol: "AVAX", name: "Avalanche",sector: "L1"     },
];

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return NaN;

  const k = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

function getSentiment(change: number | null) {
  if (change == null || Number.isNaN(change)) {
    return {
      label: "Unknown",
      color: "gray",
      description: "No clear data yet.",
    };
  }

  if (change > SENTIMENT_RULES.strongUp)
    return {
      label: "Green",
      color: "#22c55e",
      description: "Strong uptrend / FOMO zone. Late longs are risky.",
    };

  if (change > SENTIMENT_RULES.mildUp)
    return {
      label: "Light Green",
      color: "#4ade80",
      description: "Healthy uptrend. Momentum building.",
    };

  if (change < SENTIMENT_RULES.strongDown)
    return {
      label: "Red",
      color: "#ef4444",
      description: "Strong selloff / panic zone. Could be capitulation.",
    };

  if (change < SENTIMENT_RULES.mildDown)
    return {
      label: "Orange",
      color: "#fb923c",
      description: "Leaning bearish. Weakness but not full panic.",
    };

  return {
    label: "Yellow",
    color: "#eab308",
    description: "Sideways chop. Easy to get chopped up.",
  };
}

function getChangeColor(change: number | null): string {
  if (change == null || Number.isNaN(change)) return "#e5e7eb";
  if (change > 0) return "#4ade80";
  if (change < 0) return "#f97373";
  return "#e5e7eb";
}

// Trend score from EMA structure
function getTrendScore(price: number | null, trend?: TrendInfo): number {
  if (!price || !trend || Number.isNaN(trend.ema20) || Number.isNaN(trend.ema50)) {
    return 0;
  }

  const { ema20, ema50 } = trend;

  if (price > ema20 && ema20 > ema50) {
    return 2; // strong bullish stack
  }

  if (ema20 > ema50) {
    return 1; // bullish
  }

  if (price < ema20 && ema20 < ema50) {
    return -2; // strong bearish stack
  }

  return -1; // bearish
}

// Short-term momentum score from 24h % change
function getMomentumScore(change: number | null): number {
  if (change == null || Number.isNaN(change)) return 0;

  if (change > 7) return 3;
  if (change > 3) return 2;
  if (change > 0) return 1;
  if (change < -7) return -3;
  if (change < -3) return -2;
  if (change < 0) return -1;
  return 0;
}

function getTrendLabel(price: number | null, trend?: TrendInfo): string {
  const score = getTrendScore(price, trend);

  if (score === 2) return "Trend: Strong Bullish (stacked EMAs)";
  if (score === 1) return "Trend: Bullish (EMA20 above EMA50)";
  if (score === -2) return "Trend: Strong Bearish (stacked EMAs)";
  if (score === -1) return "Trend: Bearish (EMA20 below EMA50)";
  return "Trend: Unknown";
}

// Build SVG polyline points string for sparkline
function buildSparklinePoints(values: number[], width: number, height: number): string {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const stepX = n > 1 ? width / (n - 1) : 0;

  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function Home() {
  const [marketData, setMarketData] = useState<Record<string, MarketData> | null>(null);
  const [trendData, setTrendData] = useState<Record<string, TrendInfo> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [sectorFilter, setSectorFilter] = useState<"All" | Sector>("All");

  // unique sector list for buttons
  const sectors: ("All" | Sector)[] = [
    "All",
    ...Array.from(new Set(COINS.map((c) => c.sector))),
  ];

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }

        const ids = COINS.map((c) => c.id).join(",");
        const simpleUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const simpleRes = await fetch(simpleUrl);
        if (!simpleRes.ok) {
          const text = await simpleRes.text().catch(() => "");
          console.error("Simple price error", simpleRes.status, text);
          throw new Error(`Failed to fetch current prices (status ${simpleRes.status})`);
        }

        const simpleJson: Record<
          string,
          { usd: number; usd_24h_change: number }
        > = await simpleRes.json();

        const newMarketData: Record<string, MarketData> = {};
        COINS.forEach((coin) => {
          const d = simpleJson[coin.id];
          newMarketData[coin.id] = {
            price: d?.usd ?? null,
            change24h: d?.usd_24h_change ?? null,
          };
        });

        if (!cancelled) {
          setMarketData(newMarketData);
        }

        const historyPromises = COINS.map(async (coin) => {
          const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=30`;
          const res = await fetch(url);
          if (!res.ok) {
            console.warn(`Failed to fetch history for ${coin.id}`, res.status);
            return null;
          }
          const json: any = await res.json();
          const prices: number[] = (json.prices || []).map(
            (p: [number, number]) => p[1]
          );
          return {
            id: coin.id,
            prices,
          };
        });

        const histories = (await Promise.all(historyPromises)).filter(
          (h): h is { id: string; prices: number[] } => h !== null
        );

        const newTrendData: Record<string, TrendInfo> = {};
        histories.forEach((h) => {
          const ema20 = calculateEMA(h.prices, 20);
          const ema50 = calculateEMA(h.prices, 50);

          // approximate 7d change using 24 * 7 steps back (hourly data)
          let change7d: number | null = null;
          const steps7 = 24 * 7;
          if (h.prices.length > steps7) {
            const last = h.prices[h.prices.length - 1];
            const prev = h.prices[h.prices.length - 1 - steps7];
            if (prev !== 0) {
              change7d = ((last - prev) / prev) * 100;
            }
          }

          // Last N points for sparkline (e.g. last 60)
          const sparkLen = 60;
          const spark =
            h.prices.length > sparkLen
              ? h.prices.slice(-sparkLen)
              : h.prices.slice();

          newTrendData[h.id] = {
            ema20,
            ema50,
            change7d,
            spark,
          };
        });

        if (!cancelled) {
          setTrendData(newTrendData);
          setLastUpdated(new Date());
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(
            err?.message ??
              "Could not load market data. CoinGecko may be rate limiting; try again in a bit."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAll();

    // refresh less often to be nice to the free API (5 minutes)
    const interval = setInterval(fetchAll, 300_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Apply sector filter
  const visibleCoins = COINS.filter((coin) =>
    sectorFilter === "All" ? true : coin.sector === sectorFilter
  );

  // Build rotation list: who is leading / lagging among *visible* coins
  let rotationList: RotationItem[] = [];
  if (marketData) {
    rotationList = visibleCoins
      .map((coin) => {
        const md = marketData[coin.id];
        const trend = trendData ? trendData[coin.id] : undefined;
        const price = md?.price ?? null;
        const change = md?.change24h ?? null;

        const trendScore = getTrendScore(price, trend);
        const momentumScore = getMomentumScore(change);

        const score = momentumScore + 2 * trendScore;

        return { coin, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  // 🔔 Global rotation signals across *all* coins
  let signalMessages: string[] = [];
  if (marketData && trendData) {
    const items: RotationItem[] = COINS.map((coin) => {
      const md = marketData[coin.id];
      const trend = trendData[coin.id];
      const price = md?.price ?? null;
      const change = md?.change24h ?? null;
      const trendScore = getTrendScore(price, trend);
      const momentumScore = getMomentumScore(change);
      return {
        coin,
        score: momentumScore + 2 * trendScore,
      };
    });

    if (items.length > 0) {
      // Sector stats
      const sectorMap: Record<Sector, number[]> = {
        Macro: [],
        L1: [],
        Oracle: [],
      };
      items.forEach((item) => {
        sectorMap[item.coin.sector].push(item.score);
      });

      const sectorStats = (Object.entries(sectorMap) as [Sector, number[]][])
        .filter(([_, arr]) => arr.length > 0)
        .map(([sector, arr]) => ({
          sector,
          avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        }))
        .sort((a, b) => b.avg - a.avg);

      if (sectorStats.length >= 2) {
        const leader = sectorStats[0];
        const second = sectorStats[1];
        const laggard = sectorStats[sectorStats.length - 1];

        if (leader.avg >= 3 && leader.avg - second.avg >= 1.5) {
          signalMessages.push(
            `${leader.sector} sector clearly leading rotation (avg score ${leader.avg.toFixed(
              1
            )} vs ${second.sector} ${second.avg.toFixed(1)}).`
          );
        }

        if (laggard.avg <= -2) {
          signalMessages.push(
            `${laggard.sector} sector is being abandoned (avg score ${laggard.avg.toFixed(
              1
            )}).`
          );
        }
      }

      // Strongest / weakest coins
      const strongest = items.reduce((best, cur) =>
        cur.score > best.score ? cur : best
      );
      const weakest = items.reduce((worst, cur) =>
        cur.score < worst.score ? cur : worst
      );

      if (strongest.score >= 6) {
        signalMessages.push(
          `${strongest.coin.symbol} is in acceleration mode (rotation score ${strongest.score.toFixed(
            0
          )}).`
        );
      }

      if (weakest.score <= -6) {
        signalMessages.push(
          `${weakest.coin.symbol} is in capitulation mode (rotation score ${weakest.score.toFixed(
            0
          )}).`
        );
      }
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #0f172a, #020617 60%)",
        color: "#e5e7eb",
        padding: "24px",
      }}
    >
      <main style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "0.25rem",
          }}
        >
          Crypto Rotation Map
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#9ca3af",
            marginBottom: "1rem",
          }}
        >
          24h sentiment + 7d trend + EMA structure, with sector view and
          rotation signals.
        </p>

        {/* top status row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "0.75rem",
          }}
        >
          {loading && (
            <p style={{ fontSize: "0.9rem" }}>Loading market data…</p>
          )}
          {error && (
            <p style={{ fontSize: "0.9rem", color: "#fca5a5" }}>{error}</p>
          )}
          {lastUpdated && !loading && !error && (
            <p
              style={{
                marginLeft: "auto",
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              Last updated:{" "}
              {lastUpdated.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* 🔔 Rotation signals box */}
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.8rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(148,163,184,0.4)",
            boxShadow: "0 10px 25px rgba(15,23,42,0.9)",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            Rotation Signals
          </div>
          {signalMessages.length > 0 ? (
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.1rem",
                fontSize: "0.82rem",
                color: "#e5e7eb",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              {signalMessages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          ) : (
            <p
              style={{
                fontSize: "0.8rem",
                color: "#9ca3af",
                margin: 0,
              }}
            >
              No strong rotation signals yet. Market looks more balanced / noisy.
            </p>
          )}
        </div>

        {/* sector filter buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
            justifyContent: "center",
          }}
        >
          {sectors.map((sector) => {
            const isActive = sectorFilter === sector;
            return (
              <button
                key={sector}
                onClick={() => setSectorFilter(sector)}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(148,163,184,0.6)",
                  background: isActive
                    ? "rgba(59,130,246,0.9)"
                    : "rgba(15,23,42,0.9)",
                  color: "#e5e7eb",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  boxShadow: isActive
                    ? "0 0 15px rgba(59,130,246,0.8)"
                    : "none",
                  transition: "all 0.15s ease-out",
                }}
              >
                {sector === "All" ? "All Sectors" : sector}
              </button>
            );
          })}
        </div>

        {/* Rotation strip / heatmap */}
        {rotationList.length > 0 && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.9rem 1rem",
              borderRadius: "0.9rem",
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(148,163,184,0.4)",
              boxShadow: "0 14px 30px rgba(15,23,42,0.9)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "#9ca3af",
                marginBottom: "0.5rem",
              }}
            >
              Rotation order in{" "}
              <span style={{ fontWeight: 600 }}>
                {sectorFilter === "All" ? "All Sectors" : sectorFilter}
              </span>{" "}
              (left = leading, right = lagging)
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              {rotationList.map((item, index) => {
                const score = item.score;
                const isPositive = score > 0;
                const isNegative = score < 0;

                let bg = "rgba(30,64,175,0.6)";
                if (score >= 5) bg = "rgba(22,163,74,0.9)";
                else if (score > 0) bg = "rgba(34,197,94,0.7)";
                else if (score <= -5) bg = "rgba(220,38,38,0.9)";
                else if (score < 0) bg = "rgba(248,113,113,0.8)";

                return (
                  <div
                    key={item.coin.id}
                    style={{
                      flex: "1 1 120px",
                      minWidth: "120px",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "999px",
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        opacity: 0.9,
                        marginRight: "0.2rem",
                      }}
                    >
                      #{index + 1}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                      }}
                    >
                      {item.coin.symbol}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "0.75rem",
                        opacity: 0.9,
                      }}
                    >
                      {score > 0 && "+"}
                      {score.toFixed(0)}
                    </span>
                    <span
                      style={{
                        marginLeft: "0.35rem",
                        fontSize: "0.8rem",
                        opacity: 0.9,
                      }}
                    >
                      {isPositive ? "↑" : isNegative ? "↓" : "•"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-coin cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
            marginTop: "0.5rem",
          }}
        >
          {visibleCoins.map((coin) => {
            const md = marketData ? marketData[coin.id] : undefined;
            const trend = trendData ? trendData[coin.id] : undefined;
            const price = md?.price ?? null;
            const change24h = md?.change24h ?? null;
            const sentiment = getSentiment(change24h);
            const trendLabel = getTrendLabel(price, trend);

            const trendScore = getTrendScore(price, trend);
            const momentumScore = getMomentumScore(change24h);
            const rotationScore = momentumScore + 2 * trendScore;

            const change7d = trend?.change7d ?? null;

            return (
              <div
                key={coin.id}
                style={{
                  background: "rgba(15,23,42,0.9)",
                  borderRadius: "1rem",
                  padding: "1.25rem 1.5rem",
                  border: "1px solid rgba(148,163,184,0.3)",
                  boxShadow: "0 18px 45px rgba(15,23,42,0.8)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: 600,
                        marginBottom: "0.1rem",
                      }}
                    >
                      {coin.name}
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        alignItems: "center",
                        fontSize: "0.8rem",
                        color: "#9ca3af",
                      }}
                    >
                      <span>{coin.symbol}</span>
                      <span
                        style={{
                          padding: "0.1rem 0.5rem",
                          borderRadius: "999px",
                          border: "1px solid rgba(148,163,184,0.4)",
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {coin.sector}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "0.15rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "999px",
                          background: sentiment.color,
                          boxShadow: "0 0 10px rgba(255,255,255,0.3)",
                        }}
                      />
                      <span>{sentiment.label}</span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                      }}
                    >
                      Rot score:{" "}
                      {rotationScore > 0 && "+"}
                      {rotationScore.toFixed(0)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 600,
                    marginBottom: "0.4rem",
                  }}
                >
                  {price !== null ? `$${price.toLocaleString()}` : "--"}
                </div>

                {/* 24h change */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.95rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span>24h Change:</span>
                  <span
                    style={{
                      color: getChangeColor(change24h),
                    }}
                  >
                    {change24h !== null ? `${change24h.toFixed(2)}%` : "--"}
                  </span>
                </div>

                {/* 7d change */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.9rem",
                    marginBottom: "0.3rem",
                  }}
                >
                  <span>7d Change:</span>
                  <span
                    style={{
                      color: getChangeColor(change7d),
                    }}
                  >
                    {change7d !== null && !Number.isNaN(change7d)
                      ? `${change7d.toFixed(2)}%`
                      : "--"}
                  </span>
                </div>

                {/* EMAs & trend */}
                {trend &&
                  !Number.isNaN(trend.ema20) &&
                  !Number.isNaN(trend.ema50) && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span>EMA 20:</span>
                        <span>{trend.ema20.toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span>EMA 50:</span>
                        <span>{trend.ema50.toFixed(2)}</span>
                      </div>
                      <p
                        style={{
                          marginTop: "0.35rem",
                          fontSize: "0.85rem",
                          color: "#9ca3af",
                        }}
                      >
                        {trendLabel}
                      </p>
                    </>
                  )}

                {/* Sparkline */}
                {trend && trend.spark && trend.spark.length > 1 && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      marginBottom: "0.1rem",
                    }}
                  >
                    <svg
                      width={140}
                      height={40}
                      viewBox="0 0 140 40"
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: "140px",
                        overflow: "visible",
                      }}
                    >
                      <polyline
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        points={buildSparklinePoints(
                          trend.spark,
                          140,
                          40
                        )}
                      />
                    </svg>
                  </div>
                )}

                <p
                  style={{
                    marginTop: "0.45rem",
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                  }}
                >
                  {sentiment.description}
                </p>
              </div>
            );
          })}
        </div>

        <p
          style={{
            marginTop: "1.75rem",
            textAlign: "center",
            fontSize: "0.8rem",
            color: "#6b7280",
            maxWidth: "820px",
            marginInline: "auto",
          }}
        >
          Rotation score = short-term momentum (24h % change) + 2 × trend score
          (from EMA20 / EMA50 structure). Sector filter and signals help you see
          where capital is actually rotating, while sparklines give a quick
          visual of recent price action.
        </p>
      </main>
    </div>
  );
}
