"use client";

export default function Error(props: {
  error: Error;
  reset: () => void;
}) {
  console.error("App error:", props.error);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#e5e7eb",
        textAlign: "center",
        backgroundColor: "#020617",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
        Something went wrong
      </h1>
      <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
        The dashboard hit an unexpected error. You can try again.
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
        }}
      >
        Retry
      </button>
    </div>
  );
}
