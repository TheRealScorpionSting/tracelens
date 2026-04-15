function parseNetLog(json) {
  try {
    /* ==========================
       CHROMIUM NETLOG SUPPORT
    ========================== */
    if (json && Array.isArray(json.events)) {
      console.log("📡 Chromium NetLog format detected");

      return json.events.map((event) => ({
        type: String(event.type || ""),
        params: event.params || {},
        source: event.source || {},
        time: event.time || event.timeTicks || null
      }));
    }

    /* ==========================
       HAR SUPPORT
    ========================== */
    if (
      json &&
      json.log &&
      Array.isArray(json.log.entries)
    ) {
      console.log("📡 HAR format detected");

      const harEvents = [];

      json.log.entries.forEach((entry, index) => {
        const request = entry.request || {};
        const response = entry.response || {};
        const timings = entry.timings || {};

        // Convert request headers array to object
        const headers = {};
        if (Array.isArray(request.headers)) {
          request.headers.forEach((header) => {
            if (header.name) {
              headers[header.name.toLowerCase()] =
                header.value || "";
            }
          });
        }

        // Detect TLS / cert clues
        let tlsError = null;

        if (
          response.status === 495 ||
          response.status === 496 ||
          response.status === 526
        ) {
          tlsError = "TLS Certificate Validation Failure";
        }

        harEvents.push({
          type: "HAR_REQUEST",
          params: {
            url: request.url || "",
            method: request.method || "",
            headers,
            response_code: response.status || null,
            status_text: response.statusText || "",
            mime_type: response.content?.mimeType || "",
            wait_time: timings.wait || null,
            ssl_time: timings.ssl || null,
            tls_error: tlsError,
            serverIPAddress:
              entry.serverIPAddress || null
          },
          source: {
            id: index + 1
          },
          time:
            entry.startedDateTime ||
            new Date().toISOString()
        });

        // Add redirect clue
        if (
          response.status >= 300 &&
          response.status < 400
        ) {
          harEvents.push({
            type: "URL_REQUEST_REDIRECT_JOB",
            params: {
              url: request.url || "",
              response_code: response.status
            },
            source: {
              id: index + 1
            },
            time:
              entry.startedDateTime ||
              new Date().toISOString()
          });
        }

        // Add auth failure clue
        if (
          response.status === 401 ||
          response.status === 407
        ) {
          harEvents.push({
            type: "HTTP_AUTH_CONTROLLER",
            params: {
              url: request.url || "",
              response_code: response.status,
              headers
            },
            source: {
              id: index + 1
            },
            time:
              entry.startedDateTime ||
              new Date().toISOString()
          });
        }

        // Add proxy clue
        if (response.status === 407) {
          harEvents.push({
            type: "PROXY_CONNECTION",
            params: {
              url: request.url || "",
              response_code: response.status,
              headers
            },
            source: {
              id: index + 1
            },
            time:
              entry.startedDateTime ||
              new Date().toISOString()
          });
        }

        // Add TLS clue
        if (tlsError) {
          harEvents.push({
            type: "SSL_CONNECT_JOB",
            params: {
              url: request.url || "",
              response_code: response.status,
              error: tlsError
            },
            source: {
              id: index + 1
            },
            time:
              entry.startedDateTime ||
              new Date().toISOString()
          });
        }

        // Add refresh header clue
        const refreshHeaders = [
          "x-ms-refreshtokencredential",
          "x-ms-refreshtokencredential1",
          "x-ms-devicecredential",
          "x-ms-devicecredential1"
        ];

        const detectedRefreshHeaders = {};

        refreshHeaders.forEach((key) => {
          if (headers[key]) {
            detectedRefreshHeaders[key] = headers[key];
          }
        });

        if (
          Object.keys(detectedRefreshHeaders).length > 0
        ) {
          harEvents.push({
            type: "TOKEN_REFRESH_FLOW",
            params: {
              url: request.url || "",
              headers: detectedRefreshHeaders
            },
            source: {
              id: index + 1
            },
            time:
              entry.startedDateTime ||
              new Date().toISOString()
          });
        }
      });

      return harEvents;
    }

    console.warn(
      "⚠️ Unsupported file format: no events[] or HAR log.entries[]"
    );

    return [];
  } catch (error) {
    console.error(
      "❌ Parser error:",
      error.message
    );
    return [];
  }
}

module.exports = { parseNetLog };
/*
TraceLens
Created by Hariprasad Raghavan
© 2026 Hariprasad Raghavan. All Rights Reserved.
Unauthorized copying, distribution, or commercial use prohibited.
*/