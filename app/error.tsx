"use client";

export default function Error(props: { error: Error; reset: () => void }) {
  console.error("Dashboard error:", props.error);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
        color: "#e5e7eb",
        backgroundColor: "#020617",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: "0.8rem", fontSize: "1.4rem" }}>
        Something went wrong
      </h1>

      <p
        style={{
          opacity: 0.75,
          marginBottom: "1.6rem",
          maxWidth: "320px",
        }}
      >
        The dashboard hit an unexpected error. You can safely retry.
      </p>

      <button
        onClick={() => props.reset()}
        style={{
          padding: "0.6rem 1.4rem",
          borderRadius: "0.6rem",
          border: "none",
          background: "#3b82f6",
          color: "#f9fafb",
          cursor: "pointer",
          fontSize: "0.95rem",
        }}
      >
        Retry
      </button>
    </div>
  );
}
