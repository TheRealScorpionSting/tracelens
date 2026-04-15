const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const { parseNetLog } = require("./parsers/netlogParser");
const analyzeTargetUrl = require("./detectors/urlDeepAnalyzer");
const detectConnectionJourney = require("./detectors/connectionJourneyDetector");
const { detectDNSIssues } = require("./detectors/dnsDetector");
const { detectTLSIssues } = require("./detectors/tlsDetector");
const { detectProxyIssues } = require("./detectors/proxyDetector");
const detectAuthIssues = require("./detectors/authDetector");
const {
  detectRefreshCredentialIssues
} = require("./detectors/refreshCredentialDetector");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

/* ==========================
   HEALTH CHECK
========================== */
app.get("/", (req, res) => {
  res.send("TraceLens Backend Running 🚀");
});

/* ==========================
   MAIN TRACE UPLOAD API
========================== */
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    console.log("🔥 Upload API hit");

    const targetUrl = req.body.targetUrl || "";
    console.log("🎯 Target URL:", targetUrl);

    if (!req.file) {
      return res.status(400).json({
        summary: "No file uploaded",
        rootCause: "User did not upload any file",
        confidence: "Low",
        issues: []
      });
    }

    let selectedScenarios = [];

    try {
      if (req.body.scenarios) {
        selectedScenarios = JSON.parse(req.body.scenarios);
      }
    } catch {
      selectedScenarios = [];
    }

    console.log("📌 Selected scenarios:", selectedScenarios);

    const fileContent = fs.readFileSync(
      req.file.path,
      "utf-8"
    );

    let json;
    try {
      json = JSON.parse(fileContent);
    } catch {
      return res.status(400).json({
        summary: "Invalid file format",
        rootCause:
          "Uploaded file is not valid NetLog / HAR JSON",
        confidence: "Low",
        issues: []
      });
    }

    const events = parseNetLog(json) || [];
    console.log(
      "📊 Total normalized events:",
      events.length
    );

    let allIssues = [];

    const shouldRun = (scenario) =>
      selectedScenarios.includes(scenario);

    /* Target URL Deep Analysis */
    if (targetUrl && targetUrl.trim()) {
      try {
        const urlIssues =
          analyzeTargetUrl(
            events,
            targetUrl
          ) || [];
        allIssues.push(...urlIssues);
      } catch (error) {
        console.error(
          "Target URL analyzer error:",
          error.message
        );
      }
    }

    /* Connection Journey */
    if (shouldRun("connection")) {
      try {
        const connectionIssues =
          detectConnectionJourney(
            events
          ) || [];
        allIssues.push(
          ...connectionIssues
        );
      } catch (error) {
        console.error(
          "Connection journey detector error:",
          error.message
        );
      }
    }

    /* DNS */
    if (shouldRun("dns")) {
      try {
        const dnsIssues =
          detectDNSIssues(
            events
          ) || [];
        allIssues.push(...dnsIssues);
      } catch (error) {
        console.error(
          "DNS detector error:",
          error.message
        );
      }
    }

    /* TLS */
    if (shouldRun("tls")) {
      try {
        const tlsIssues =
          detectTLSIssues(
            events
          ) || [];
        allIssues.push(...tlsIssues);
      } catch (error) {
        console.error(
          "TLS detector error:",
          error.message
        );
      }
    }

    /* Proxy */
    if (shouldRun("proxy")) {
      try {
        const proxyIssues =
          detectProxyIssues(
            events
          ) || [];
        allIssues.push(
          ...proxyIssues
        );
      } catch (error) {
        console.error(
          "Proxy detector error:",
          error.message
        );
      }
    }

    /* Auth */
    if (shouldRun("auth")) {
      try {
        const authIssues =
          detectAuthIssues(
            events
          ) || [];
        allIssues.push(...authIssues);
      } catch (error) {
        console.error(
          "Auth detector error:",
          error.message
        );
      }
    }

    /* Refresh */
    if (shouldRun("refresh")) {
      try {
        const refreshIssues =
          detectRefreshCredentialIssues(
            events
          ) || [];
        allIssues.push(
          ...refreshIssues
        );
      } catch (error) {
        console.error(
          "Refresh detector error:",
          error.message
        );
      }
    }

    console.log(
      "🧠 Total issues found:",
      allIssues.length
    );

    if (allIssues.length === 0) {
      return res.json({
        summary: "No issues found",
        rootCause:
          "No selected scenario issues detected in uploaded trace",
        confidence: "High",
        issues: []
      });
    }

    const priorityOrder = [
      "TARGET_URL_ANALYSIS",
      "CONNECTION_JOURNEY",
      "DNS",
      "TLS",
      "PROXY",
      "AUTH",
      "REFRESH"
    ];

    const rootIssue =
      allIssues.find((issue) =>
        priorityOrder.includes(
          issue.type
        )
      ) || allIssues[0];

    try {
      fs.unlinkSync(
        req.file.path
      );
    } catch {}

    return res.json({
      summary: "Issues detected",
      rootCause:
        rootIssue.rootCause ||
        rootIssue.title ||
        "Issue detected",
      confidence:
        rootIssue.confidence ||
        "High",
      issues: allIssues
    });
  } catch (error) {
    console.error(
      "🔥 Backend error:",
      error.message
    );

    return res.status(500).json({
      summary:
        "Internal server error",
      rootCause:
        error.message ||
        "Unexpected backend error",
      confidence: "Low",
      issues: []
    });
  }
});

/* ==========================
   START SERVER
========================== */
app.listen(3001, () => {
  console.log(
    "🚀 TraceLens backend running on http://localhost:3001"
  );
});