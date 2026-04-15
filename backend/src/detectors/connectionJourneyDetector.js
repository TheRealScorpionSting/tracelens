function detectConnectionJourney(events = []) {
  try {
    const issues = [];
    const requestFlows = {};

    /* =========================================
       GROUP EVENTS BY REQUEST / SOURCE ID
    ========================================= */
    for (const event of events) {
      const sourceId = event.source?.id || "unknown";
      const eventType = String(event.type || "");
      const params = event.params || {};

      if (!requestFlows[sourceId]) {
        requestFlows[sourceId] = {
          sourceId,
          hostname: "",
          url: "",
          dns: [],
          tcp: [],
          tls: [],
          http: [],
          finalStatus: null,
          timeline: []
        };
      }

      const flow = requestFlows[sourceId];

      const url =
        params.url ||
        params.request_url ||
        params.original_url ||
        "";

      if (url) {
        flow.url = url;
        flow.hostname = extractHostname(url);
      }

      /* DNS */
      if (
        /HOST_RESOLVER/i.test(eventType)
      ) {
        flow.dns.push({
          eventType,
          error:
            params.net_error ||
            params.error ||
            "Success",
          time: event.time
        });
      }

      /* TCP */
      if (
        /SOCKET_CONNECT|TCP_CONNECT|TRANSPORT_CONNECT/i.test(
          eventType
        )
      ) {
        flow.tcp.push({
          eventType,
          error:
            params.net_error ||
            params.error ||
            "Success",
          address:
            params.address ||
            params.ip_address ||
            "",
          time: event.time
        });
      }

      /* TLS */
      if (
        /SSL_CONNECT|SSL_HANDSHAKE|SSL_CERT/i.test(
          eventType
        )
      ) {
        flow.tls.push({
          eventType,
          error:
            params.net_error ||
            params.error ||
            "Success",
          certStatus:
            params.cert_status ||
            "",
          time: event.time
        });
      }

      /* HTTP */
      if (
        /URL_REQUEST|HTTP_STREAM|HTTP2_SESSION|QUIC_SESSION/i.test(
          eventType
        )
      ) {
        flow.http.push({
          eventType,
          responseCode:
            params.response_code ||
            params.status ||
            null,
          error:
            params.net_error ||
            params.error ||
            "Success",
          headers:
            params.headers || {},
          time: event.time
        });
      }
    }

    /* =========================================
       BUILD JOURNEY OUTPUT
    ========================================= */
    Object.values(requestFlows).forEach((flow) => {
      if (!flow.url && !flow.hostname) {
        return;
      }

      const timeline = [];
      let failureStage = null;
      let summary = "";

      /* DNS */
      if (flow.dns.length > 0) {
        const dnsFailure = flow.dns.find(
          (e) =>
            String(e.error).includes("ERR") ||
            String(e.error).includes("-")
        );

        if (dnsFailure) {
          failureStage = "DNS";

          timeline.push({
            stage: "DNS",
            status: "Failed",
            explanation:
              `DNS resolution failed for ${flow.hostname}. ` +
              `Chromium host resolver returned ${dnsFailure.error}.`
          });
        } else {
          timeline.push({
            stage: "DNS",
            status: "Success",
            explanation:
              `DNS lookup completed successfully for ${flow.hostname}.`
          });
        }
      }

      /* TCP */
      if (!failureStage && flow.tcp.length > 0) {
        const tcpFailure = flow.tcp.find(
          (e) =>
            String(e.error).includes("ERR") ||
            String(e.error).includes("-")
        );

        if (tcpFailure) {
          failureStage = "TCP";

          timeline.push({
            stage: "TCP",
            status: "Failed",
            explanation:
              `TCP connection failed. Browser could not establish socket to ${flow.hostname}. ` +
              `Error: ${tcpFailure.error}.`
          });
        } else {
          timeline.push({
            stage: "TCP",
            status: "Success",
            explanation:
              "TCP three-way handshake completed successfully."
          });
        }
      }

      /* TLS */
      if (!failureStage && flow.tls.length > 0) {
        const tlsFailure = flow.tls.find(
          (e) =>
            String(e.error).includes("ERR") ||
            String(e.certStatus).length > 0
        );

        if (tlsFailure) {
          failureStage = "TLS";

          timeline.push({
            stage: "TLS",
            status: "Failed",
            explanation:
              `TLS handshake failed for ${flow.hostname}. ` +
              `Browser reported ${tlsFailure.error || tlsFailure.certStatus}.`
          });
        } else {
          timeline.push({
            stage: "TLS",
            status: "Success",
            explanation:
              "TLS handshake completed successfully with valid certificate."
          });
        }
      }

      /* HTTP */
      if (!failureStage && flow.http.length > 0) {
        const httpFailure = flow.http.find(
          (e) =>
            (e.responseCode &&
              Number(e.responseCode) >= 400) ||
            String(e.error).includes("ERR")
        );

        if (httpFailure) {
          failureStage = "HTTP";

          timeline.push({
            stage: "HTTP",
            status: "Failed",
            explanation:
              `HTTP request failed with status ${httpFailure.responseCode || httpFailure.error}.`
          });
        } else {
          const lastHttp =
            flow.http[flow.http.length - 1];

          timeline.push({
            stage: "HTTP",
            status: "Success",
            explanation:
              `HTTP request completed successfully. Response code: ${
                lastHttp.responseCode || 200
              }.`
          });
        }
      }

      /* Final */
      if (failureStage) {
        summary =
          `Connection failed at ${failureStage} stage for ${flow.hostname}.`;
      } else {
        timeline.push({
          stage: "Page Load",
          status: "Success",
          explanation:
            `${flow.hostname} loaded successfully without detected errors.`
        });

        summary =
          `${flow.hostname} loaded successfully. DNS, TCP, TLS and HTTP flow completed.`;
      }

      issues.push({
        type: "CONNECTION_JOURNEY",
        title:
          `Connection Flow for ${flow.hostname || "Unknown Host"}`,
        confidence: "High",
        rootCause: summary,
        reasoning:
          "TraceLens reconstructed the Chromium / Edge request lifecycle using correlated NetLog events.",
        timeline,
        evidence: {
          hostname: flow.hostname,
          url: flow.url,
          requestId: flow.sourceId,
          dnsEvents: flow.dns.length,
          tcpEvents: flow.tcp.length,
          tlsEvents: flow.tls.length,
          httpEvents: flow.http.length
        },
        suggestions: failureStage
          ? getRecommendations(failureStage)
          : [
              "No issues detected. Browser successfully completed connection journey."
            ]
      });
    });

    return issues;
  } catch (error) {
    console.error(
      "Connection journey detector error:",
      error.message
    );
    return [];
  }
}

/* =========================================
   HELPERS
========================================= */
function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Unknown";
  }
}

function getRecommendations(stage) {
  switch (stage) {
    case "DNS":
      return [
        "Verify DNS resolution using nslookup.",
        "Check VPN / proxy DNS overrides.",
        "Validate firewall DNS restrictions."
      ];
    case "TCP":
      return [
        "Check network path / firewall.",
        "Verify destination port reachability.",
        "Inspect packet drops / resets."
      ];
    case "TLS":
      return [
        "Check certificate trust chain.",
        "Validate TLS inspection devices.",
        "Review certificate expiry / hostname."
      ];
    case "HTTP":
      return [
        "Check server response logs.",
        "Inspect redirects / auth flow.",
        "Validate proxy / CDN path."
      ];
    default:
      return ["Review browser network trace."];
  }
}

module.exports = detectConnectionJourney;