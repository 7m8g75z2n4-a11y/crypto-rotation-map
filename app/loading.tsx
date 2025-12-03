export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #0f172a, #020617 60%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        color: "#e5e7eb",
        textAlign: "center",
        padding: "1.5rem",
      }}
    >
      <img
        src="/icons/icon-192.png"
        alt="Crypto Rotation Map"
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "24px",
          boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
        }}
      />

      <div>
        <h1
          style={{
            fontSize: "1.4rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: 0,
            opacity: 0.9,
          }}
        >
          Crypto Rotation Map
        </h1>
        <p
          style={{
            marginTop: "0.4rem",
            fontSize: "0.9rem",
            opacity: 0.7,
          }}
        >
          Calibrating sectors and signals…
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          marginTop: "0.6rem",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: "#38bdf8",
            opacity: 0.9,
          }}
        />
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: "#22c55e",
            opacity: 0.6,
          }}
        />
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: "#facc15",
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}
