function detectDNSIssues(events) {
  console.log("🌐 Chromium DNS DETECTOR RUNNING");

  const issues = [];

  if (!Array.isArray(events) || events.length === 0) {
    return issues;
  }

  // Chromium / NetLog DNS errors
  const DNS_ERROR_MAP = {
    "-105": "ERR_NAME_NOT_RESOLVED",
    "-118": "ERR_CONNECTION_TIMED_OUT",
    "-137": "ERR_NAME_RESOLUTION_FAILED",
    "-109": "ERR_ADDRESS_UNREACHABLE",
    "-106": "ERR_INTERNET_DISCONNECTED",
    "-802": "ERR_DNS_TIMED_OUT"
  };

  const failedLookups = [];

  for (const event of events) {
    if (!event || !event.type) continue;

    const eventType = event.type;
    const params = event.params || {};
    const source = event.source || {};

    const isDnsEvent =
      eventType.includes("HOST_RESOLVER") ||
      eventType.includes("DNS");

    if (!isDnsEvent) continue;

    // Host extraction
    let hostname =
      params.host ||
      params.hostname ||
      params.dns_query ||
      params.address_list ||
      params.url ||
      "Unknown Host";

    if (typeof hostname === "string" && hostname.includes("http")) {
      try {
        hostname = new URL(hostname).hostname;
      } catch {
        // ignore parsing errors
      }
    }

    // Chromium NetLog errors
    let error =
      params.net_error ||
      params.error ||
      params.os_error ||
      null;

    if (error !== null && error !== undefined) {
      error = String(error);
    }

    const mappedError = DNS_ERROR_MAP[error];

    const isFailure =
      mappedError ||
      (error &&
        (
          error.includes("ERR_NAME_NOT_RESOLVED") ||
          error.includes("ERR_DNS") ||
          error.includes("NAME_NOT_RESOLVED") ||
          error.includes("DNS_TIMED_OUT")
        ));

    if (isFailure) {
      failedLookups.push({
        eventType,
        hostname,
        requestId: source.id || "N/A",
        timestamp: event.time || event.timeTicks || "N/A",
        error: mappedError || error
      });
    }
  }

  if (failedLookups.length > 0) {
    const firstFailure = failedLookups[0];

    issues.push({
      type: "DNS",
      title: "DNS Resolution Failure",
      confidence: failedLookups.length >= 3 ? "High" : "Medium",
      rootCause: `DNS lookup failed for ${firstFailure.hostname}`,
      reasoning:
        `TraceLens found ${failedLookups.length} Chromium NetLog DNS failure event(s). ` +
        `The browser attempted hostname resolution for ${firstFailure.hostname} ` +
        `during ${firstFailure.eventType}, but failed with ${firstFailure.error}. ` +
        `This indicates DNS resolution failed before TCP connection or TLS handshake could begin.`,
      evidence: {
        eventType: firstFailure.eventType,
        hostname: firstFailure.hostname,
        requestId: firstFailure.requestId,
        error: firstFailure.error,
        timestamp: firstFailure.timestamp
      },
      suggestions: [
        "Check DNS server configuration",
        "Run nslookup for the affected hostname",
        "Verify VPN or proxy settings",
        "Check firewall or enterprise network restrictions",
        "Try the same URL on another network"
      ]
    });
  }

  return issues;
}

module.exports = { detectDNSIssues };