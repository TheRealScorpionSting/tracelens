function detectTLSIssues(events) {
  console.log("🔐 Chromium TLS DETECTOR RUNNING");

  const issues = [];

  if (!Array.isArray(events) || events.length === 0) {
    return issues;
  }

  // Chromium TLS / Cert error map
  const TLS_ERROR_MAP = {
    "-200": "ERR_CERT_COMMON_NAME_INVALID",
    "-201": "ERR_CERT_DATE_INVALID",
    "-202": "ERR_CERT_AUTHORITY_INVALID",
    "-113": "ERR_SSL_VERSION_OR_CIPHER_MISMATCH",
    "-107": "ERR_SSL_PROTOCOL_ERROR",
    "-122": "ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN",
    "-126": "ERR_CERT_WEAK_SIGNATURE_ALGORITHM",
    "-501": "ERR_INSECURE_RESPONSE"
  };

  const failedTlsEvents = [];

  for (const event of events) {
    if (!event || !event.type) continue;

    const eventType = event.type;
    const params = event.params || {};
    const source = event.source || {};

    const isTlsEvent =
      eventType.includes("SSL") ||
      eventType.includes("TLS") ||
      eventType.includes("CERT");

    if (!isTlsEvent) continue;

    let url =
      params.url ||
      params.host ||
      params.hostname ||
      "Unknown URL";

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
      params.cert_error ||
      null;

    if (error !== null && error !== undefined) {
      error = String(error);
    }

    const mappedError = TLS_ERROR_MAP[error];

    const isFailure =
      mappedError ||
      (error &&
        (
          error.includes("ERR_CERT") ||
          error.includes("ERR_SSL") ||
          error.includes("SSL_PROTOCOL")
        ));

    if (isFailure) {
      failedTlsEvents.push({
        eventType,
        hostname,
        url,
        requestId: source.id || "N/A",
        timestamp: event.time || event.timeTicks || "N/A",
        error: mappedError || error
      });
    }
  }

  if (failedTlsEvents.length > 0) {
    const firstFailure = failedTlsEvents[0];

    issues.push({
      type: "TLS",
      title: "TLS / SSL Handshake Failure",
      confidence: failedTlsEvents.length >= 2 ? "High" : "Medium",
      rootCause:
        `TLS handshake failed for ${firstFailure.hostname}`,
      reasoning:
        `TraceLens detected ${failedTlsEvents.length} Chromium NetLog TLS failure event(s). ` +
        `The browser attempted a secure connection to ${firstFailure.hostname} ` +
        `during ${firstFailure.eventType}, but failed with ${firstFailure.error}. ` +
        `This indicates certificate validation failure, unsupported TLS protocol, ` +
        `or handshake negotiation failure.`,
      evidence: {
        eventType: firstFailure.eventType,
        hostname: firstFailure.hostname,
        url: firstFailure.url,
        requestId: firstFailure.requestId,
        error: firstFailure.error,
        timestamp: firstFailure.timestamp
      },
      suggestions: [
        "Check certificate trust chain",
        "Verify certificate expiry date",
        "Ensure hostname matches certificate SAN",
        "Check TLS protocol / cipher compatibility",
        "Inspect SSL interception or proxy"
      ]
    });
  }

  return issues;
}

module.exports = { detectTLSIssues };