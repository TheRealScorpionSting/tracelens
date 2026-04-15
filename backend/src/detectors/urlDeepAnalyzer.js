function analyzeTargetUrl(events = [], targetUrl = "") {
  try {
    if (!targetUrl || !targetUrl.trim()) {
      return [];
    }

    const cleanTarget = targetUrl.trim().toLowerCase();
    const matchedRequests = {};

    /* ==========================
       STEP 1: MATCH REQUESTS
    ========================== */
    for (const event of events) {
      const params = event.params || {};
      const sourceId = event.source?.id || "unknown";
      const eventType = String(event.type || "");
      const url =
        params.url ||
        params.request_url ||
        params.original_url ||
        "";

      const method =
        params.method ||
        params.request_method ||
        "";

      const headers =
        params.headers ||
        params.request_headers ||
        {};

      const responseCode =
        params.response_code ||
        params.status ||
        null;

      const responseHeaders =
        params.response_headers ||
        params.headers ||
        {};

      const timestamp = event.time || null;

      if (
        url &&
        isUrlMatch(url.toLowerCase(), cleanTarget)
      ) {
        if (!matchedRequests[sourceId]) {
          matchedRequests[sourceId] = {
            sourceId,
            url,
            method: method || "GET",
            requestHeaders: headers,
            responseHeaders: {},
            statusCode: null,
            timestamps: [],
            networkStages: {
              dns: false,
              tcp: false,
              tls: false
            },
            errors: []
          };
        }

        const req = matchedRequests[sourceId];

        req.timestamps.push(timestamp);

        /* Method */
        if (method) {
          req.method = method;
        }

        /* Request headers */
        if (
          headers &&
          Object.keys(headers).length > 0
        ) {
          req.requestHeaders = headers;
        }

        /* Response */
        if (responseCode) {
          req.statusCode = responseCode;
        }

        if (
          responseHeaders &&
          Object.keys(responseHeaders).length > 0
        ) {
          req.responseHeaders = responseHeaders;
        }

        /* DNS */
        if (/HOST_RESOLVER/i.test(eventType)) {
          req.networkStages.dns = true;
        }

        /* TCP */
        if (
          /TCP_CONNECT|SOCKET_CONNECT/i.test(eventType)
        ) {
          req.networkStages.tcp = true;
        }

        /* TLS */
        if (
          /SSL_CONNECT|SSL_HANDSHAKE|SSL_CERT/i.test(
            eventType
          )
        ) {
          req.networkStages.tls = true;
        }

        /* Errors */
        const error =
          params.net_error ||
          params.error ||
          null;

        if (
          error &&
          String(error).includes("ERR")
        ) {
          req.errors.push(error);
        }
      }
    }

    /* ==========================
       STEP 2: BUILD OUTPUT
    ========================== */
    const issues = [];

    Object.values(matchedRequests).forEach(
      (request) => {
        const latency =
          request.timestamps.length > 1
            ? Math.max(...request.timestamps) -
              Math.min(...request.timestamps)
            : null;

        const failureReason =
          deriveFailureReason(request);

        const success =
          request.statusCode &&
          Number(request.statusCode) < 400 &&
          request.errors.length === 0;

        issues.push({
          type: "TARGET_URL_ANALYSIS",
          title: "Target URL Request Analysis",
          confidence: "High",
          rootCause: success
            ? `Target URL loaded successfully (${request.statusCode}).`
            : failureReason,
          reasoning:
            success
              ? "TraceLens matched the requested target URL and confirmed request / response success."
              : "TraceLens matched the target URL and identified request / response issues from Chromium trace evidence.",
          matchedUrl: request.url,
          requestMethod:
            request.method || "GET",
          statusCode:
            request.statusCode || "Unknown",
          responseSummary: success
            ? "Request completed successfully."
            : failureReason,
          evidence: {
            url: request.url,
            method: request.method,
            statusCode:
              request.statusCode || "Unknown",
            latency:
              latency !== null
                ? `${latency} ms`
                : "Unknown",
            dnsCompleted:
              request.networkStages.dns,
            tcpCompleted:
              request.networkStages.tcp,
            tlsCompleted:
              request.networkStages.tls,
            errors: request.errors
          },
          suggestions: success
            ? [
                "Target request completed successfully. No action needed."
              ]
            : getRecommendations(request)
        });
      }
    );

    if (issues.length === 0) {
      return [
        {
          type: "TARGET_URL_ANALYSIS",
          title: "Target URL Request Analysis",
          confidence: "Medium",
          rootCause:
            "Target URL not found in uploaded trace.",
          reasoning:
            "TraceLens could not find a request matching the provided URL / endpoint.",
          matchedUrl: targetUrl,
          evidence: {
            searchedTarget: targetUrl
          },
          suggestions: [
            "Verify the exact URL or endpoint path.",
            "Ensure trace was captured while reproducing issue.",
            "Try hostname or partial path instead."
          ]
        }
      ];
    }

    return issues;
  } catch (error) {
    console.error(
      "Target URL analyzer error:",
      error.message
    );
    return [];
  }
}

/* ==========================
   HELPERS
========================== */
function isUrlMatch(url, target) {
  return (
    url === target ||
    url.includes(target) ||
    extractHostname(url) === target
  );
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function deriveFailureReason(request) {
  if (request.errors.length > 0) {
    return `Target URL failed with browser error: ${request.errors[0]}`;
  }

  if (
    request.statusCode &&
    Number(request.statusCode) >= 500
  ) {
    return `Server returned ${request.statusCode}. Server-side issue detected.`;
  }

  if (
    request.statusCode &&
    Number(request.statusCode) >= 400
  ) {
    return `HTTP ${request.statusCode} client-side request failure detected.`;
  }

  if (!request.networkStages.dns) {
    return "DNS resolution may have failed before request was sent.";
  }

  if (!request.networkStages.tcp) {
    return "TCP connection was not successfully established.";
  }

  if (!request.networkStages.tls) {
    return "TLS handshake may have failed before request completion.";
  }

  return "Target URL request failed due to unknown browser trace issue.";
}

function getRecommendations(request) {
  const suggestions = [];

  if (request.errors.length > 0) {
    suggestions.push(
      "Review browser network errors and trace evidence."
    );
  }

  if (!request.networkStages.dns) {
    suggestions.push(
      "Check DNS resolution and network path."
    );
  }

  if (!request.networkStages.tcp) {
    suggestions.push(
      "Verify TCP connectivity and firewall."
    );
  }

  if (!request.networkStages.tls) {
    suggestions.push(
      "Check TLS certificates and SSL inspection."
    );
  }

  if (
    request.statusCode &&
    Number(request.statusCode) >= 400
  ) {
    suggestions.push(
      "Inspect server logs / auth redirects / headers."
    );
  }

  return suggestions.length > 0
    ? suggestions
    : [
        "Review full request / response trace."
      ];
}

module.exports = analyzeTargetUrl;