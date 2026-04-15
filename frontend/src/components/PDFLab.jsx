import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/* IMPORTANT:
   Uses local bundled worker matching installed pdfjs version */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PDFLab() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [zoom, setZoom] = useState(1);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];

      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        alert("Please upload a valid PDF file.");
      }
    }
  };

  const renderViewerCard = (title, borderColor) => (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "20px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        minHeight: "750px",
        overflowY: "auto",
        borderTop: `6px solid ${borderColor}`
      }}
    >
      <h3
        style={{
          fontSize: "24px",
          fontWeight: "700",
          marginBottom: "16px",
          color: "#0f172a"
        }}
      >
        {title}
      </h3>

      {file ? (
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading="Loading PDF..."
          error="Failed to load PDF file."
        >
          {Array.from(new Array(numPages || 0), (_, index) => (
            <div
              key={`page_${index + 1}`}
              style={{
                marginBottom: "20px",
                display: "flex",
                justifyContent: "center"
              }}
            >
              <Page
                pageNumber={index + 1}
                scale={zoom}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          ))}
        </Document>
      ) : (
        <div
          style={{
            color: "#64748b",
            marginTop: "40px",
            textAlign: "center"
          }}
        >
          Upload a PDF to begin comparison.
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #dbeafe, #f8fafc)",
        padding: "24px",
        fontFamily: "Segoe UI, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "1800px",
          margin: "0 auto"
        }}
      >
        {/* HEADER */}
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "clamp(32px, 4vw, 64px)",
              fontWeight: "800",
              color: "#0f172a",
              marginBottom: "12px"
            }}
          >
            PDF Comparison Lab
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2vw, 24px)",
              color: "#475569"
            }}
          >
            Compare PDF rendering across Chromium, Edge, and Adobe-style viewers.
          </p>
        </div>

        {/* TOP CONTROLS */}
        <div
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            marginBottom: "32px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)"
          }}
        >
          {/* Upload Area */}
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            style={{
              padding: "32px",
              border: dragActive
                ? "3px solid #2563eb"
                : "2px dashed #cbd5e1",
              borderRadius: "20px",
              background: dragActive ? "#eff6ff" : "#f8fafc",
              cursor: "pointer",
              transition: "all 0.3s ease"
            }}
          >
            <label style={{ cursor: "pointer" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "600",
                  color: "#1e293b",
                  marginBottom: "12px"
                }}
              >
                Drag & Drop or Upload PDF
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: "18px"
                }}
              >
                {file ? file.name : "No PDF selected"}
              </div>

              <input
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const selectedFile = e.target.files[0];

                  if (
                    selectedFile &&
                    selectedFile.type === "application/pdf"
                  ) {
                    setFile(selectedFile);
                  } else {
                    alert("Please upload a valid PDF.");
                  }
                }}
              />
            </label>
          </div>

          {/* Zoom Controls */}
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap"
            }}
          >
            <button
              onClick={() =>
                setZoom((prev) => Math.max(0.5, prev - 0.1))
              }
              style={{
                background: "#0f172a",
                color: "white",
                border: "none",
                padding: "12px 20px",
                borderRadius: "12px",
                cursor: "pointer"
              }}
            >
              -
            </button>

            <div
              style={{
                fontWeight: "600",
                fontSize: "18px"
              }}
            >
              Zoom: {(zoom * 100).toFixed(0)}%
            </div>

            <button
              onClick={() => setZoom((prev) => prev + 0.1)}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                padding: "12px 20px",
                borderRadius: "12px",
                cursor: "pointer"
              }}
            >
              +
            </button>

            <button
              onClick={() => (window.location.href = "/")}
              style={{
                marginLeft: "auto",
                background: "#64748b",
                color: "white",
                border: "none",
                padding: "12px 20px",
                borderRadius: "12px",
                cursor: "pointer"
              }}
            >
              ← Back to TraceLens
            </button>
          </div>
        </div>

        {/* PDF VIEWERS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              window.innerWidth < 1200
                ? "1fr"
                : "repeat(3, 1fr)",
            gap: "24px"
          }}
        >
          {renderViewerCard("Chromium PDF Viewer", "#2563eb")}
          {renderViewerCard("Microsoft Edge PDF Reader", "#0f172a")}
          {renderViewerCard("Adobe Style Viewer", "#dc2626")}
        </div>
      </div>
    </div>
  );
}