"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>
            Đã xảy ra lỗi
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>
            {error.message || "Lỗi hệ thống. Vui lòng thử lại."}
          </p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
