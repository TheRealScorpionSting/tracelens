import React from "react";

export default function Upload() {
  const page = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #f5f3ff 45%, #e2e8f0 100%)",
    padding: "24px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
  };

  const grid = {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns:
      window.innerWidth > 1100 ? "360px 1fr" : "1fr",
    gap: "24px"
  };

  const leftPanel = {
    borderRadius: "32px",
    background:
      "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #5b21b6 100%)",
    color: "white",
    padding: "32px",
    boxShadow: "0 18px 40px rgba(15,23,42,0.25)"
  };

  const card = {
    borderRadius: "32px",
    background: "rgba(255,255,255,0.85)",
    padding: "32px",
    boxShadow: "0 18px 40px rgba(15,23,42,0.12)"
  };

  const scenarioBtn = {
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    background: "white",
    padding: "20px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 14px rgba(15,23,42,0.06)"
  };

  return (
    <div style={page}>
      <div style={grid}>
        <div style={leftPanel}>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: "18px",
                  padding: "14px",
                  fontSize: "28px"
                }}
              >
                🔎
              </div>
              <div style={{ fontSize: "34px", fontWeight: 700 }}>TraceLens</div>
            </div>
            <div
              style={{
                marginTop: "10px",
                color: "#ddd6fe",
                fontSize: "15px",
                fontWeight: 500
              }}
            >
              Trace Deeper, Resolve Faster.
            </div>
          </div>

          <h1
            style={{
              fontSize: "46px",
              lineHeight: 1.15,
              margin: 0,
              fontWeight: 700
            }}
          >
            Trace Smarter.
            <br />
            Resolve Faster.
          </h1>

          <p
            style={{
              marginTop: "24px",
              color: "#ddd6fe",
              fontSize: "18px",
              lineHeight: 1.6
            }}
          >
            Upload Edge / Chrome NetLogs, HAR files, and browser traces to get
            clear root-cause insights with guided remediation.
          </p>
        </div>

        <div style={card}>
          <div style={{ marginBottom: "28px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "52px",
                color: "#0f172a",
                fontWeight: 700
              }}
            >
              Start Analysis
            </h2>
            <p
              style={{
                marginTop: "12px",
                fontSize: "18px",
                color: "#475569"
              }}
            >
              Upload your trace, choose what to analyze, and get a simple,
              guided explanation.
            </p>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <div
              style={{
                marginBottom: "14px",
                fontSize: "18px",
                fontWeight: 600,
                color: "#0f172a"
              }}
            >
              Select Analysis Areas
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  window.innerWidth > 900 ? "repeat(3, 1fr)" : "1fr",
                gap: "16px"
              }}
            >
              {[
                ["🌐", "Connectivity", "DNS / TLS / TCP"],
                ["🔐", "Authentication", "SSO / login"],
                ["🛰️", "Proxy", "Routing / PAC"],
                ["🔁", "Refresh", "Device credentials"],
                ["📊", "Journey", "Page load flow"]
              ].map(([icon, title, subtitle]) => (
                <button key={title} style={scenarioBtn}>
                  <div style={{ fontSize: "24px", marginBottom: "10px" }}>{icon}</div>
                  <div style={{ fontSize: "22px", fontWeight: 600, color: "#0f172a" }}>
                    {title}
                  </div>
                  <div style={{ marginTop: "6px", color: "#64748b" }}>{subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: "32px",
              padding: "48px 24px",
              textAlign: "center",
              background: "#f8fafc"
            }}
          >
            <div style={{ fontSize: "56px" }}>📂</div>
            <h3 style={{ fontSize: "42px", margin: "18px 0 8px", color: "#0f172a" }}>
              Drag & Drop or Choose Trace File
            </h3>
            <p style={{ fontSize: "18px", color: "#64748b" }}>
              Supports NetLog JSON and HAR exports from Edge / Chrome.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
