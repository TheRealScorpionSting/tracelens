function detectProxyIssues(events) {
  console.log("🌐 Chromium PROXY DETECTOR RUNNING");

  const issues = [];

  if (!Array.isArray(events) || events.length === 0) {
    return issues;
  }

  // Chromium proxy / tunnel / connect errors
  const PROXY_ERROR_MAP = {
    "-111": "ERR_TUNNEL_CONNECTION_FAILED",
    "-130": "ERR_PROXY_CONNECTION_FAILED",
    "-336": "ERR_NO_SUPPORTED_PROXIES",
    "-140": "ERR_PROXY_CERTIFICATE_INVALID",
    "-115": "ERR_CONNECTION_CLOSED"
  };

  const proxyFailures = [];

  for (const event of events) {
    if (!event || !event.type) continue;

    const eventType = event.type;
    const params = event.params || {};
    const source = event.source || {};

    const isProxyEvent =
      eventType.includes("PROXY") ||
      eventType.includes("TUNNEL") ||
      eventType.includes("CONNECT") ||
      eventType.includes("HTTP_STREAM");

    if (!isProxyEvent) continue;

    let url =
      params.url ||
      params.proxy_server ||
      params.host ||
      "Unknown Target";

    let hostname = url;

    if (typeof url === "string" && url.includes("http")) {
      try {
        hostname = new URL(url).hostname;
      } catch {
        hostname = url;
      }
    }

    let error =
      params.net_error ||
      params.error ||
      params.proxy_error ||
      null;

    const responseCode =
      params.response_code ||
      params.status_code ||
      null;

    if (error !== null && error !== undefined) {
      error = String(error);
    }

    const mappedError = PROXY_ERROR_MAP[error];

    const isFailure =
      mappedError ||
      responseCode === 407 ||
      (error &&
        (
          error.includes("ERR_PROXY") ||
          error.includes("ERR_TUNNEL") ||
          error.includes("PROXY_CONNECTION")
        ));

    if (isFailure) {
      proxyFailures.push({
        eventType,
        hostname,
        url,
        requestId: source.id || "N/A",
        timestamp: event.time || event.timeTicks || "N/A",
        error: mappedError || error || "HTTP 407 Proxy Auth Required",
        responseCode: responseCode || "N/A"
      });
    }
  }

  if (proxyFailures.length > 0) {
    const firstFailure = proxyFailures[0];

    issues.push({
      type: "PROXY",
      title: "Proxy / Tunnel Connection Failure",
      confidence: proxyFailures.length >= 2 ? "High" : "Medium",
      rootCause:
        `Proxy connection failed while accessing ${firstFailure.hostname}`,
      reasoning:
        `TraceLens detected ${proxyFailures.length} Chromium NetLog proxy-related failure event(s). ` +
        `The browser failed during ${firstFailure.eventType} while connecting to ` +
        `${firstFailure.hostname}. Error observed: ${firstFailure.error}. ` +
        `This indicates proxy tunnel establishment failure, proxy auth challenge, ` +
        `or unsupported proxy configuration.`,
      evidence: {
        eventType: firstFailure.eventType,
        hostname: firstFailure.hostname,
        url: firstFailure.url,
        requestId: firstFailure.requestId,
        error: firstFailure.error,
        responseCode: firstFailure.responseCode,
        timestamp: firstFailure.timestamp
      },
      suggestions: [
        "Verify proxy server address / port",
        "Check PAC / WPAD configuration",
        "Inspect proxy authentication settings",
        "Check VPN or enterprise tunnel restrictions",
        "Test access without proxy"
      ]
    });
  }

  return issues;
}

module.exports = { detectProxyIssues };