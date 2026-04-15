function detectRefreshCredentialIssues(events) {
  console.log("🔄 Chromium REFRESH TOKEN DETECTOR RUNNING");

  const issues = [];

  if (!Array.isArray(events) || events.length === 0) {
    return issues;
  }

  const REQUIRED_HEADERS = [
    "x-ms-refreshtokencredential",
    "x-ms-refreshtokencredential1",
    "x-ms-devicecredential",
    "x-ms-devicecredential1"
  ];

  const detectedHeaders = [];
  const authRequests = [];

  for (const event of events) {
    if (!event || !event.type) continue;

    const eventType = event.type;
    const params = event.params || {};
    const source = event.source || {};

    const url =
      params.url ||
      params.request_url ||
      params.host ||
      "Unknown URL";

    // focus on auth / token endpoints
    const isRelevantAuthFlow =
      String(url).toLowerCase().includes("login.microsoftonline.com") ||
      String(url).toLowerCase().includes("token") ||
      String(url).toLowerCase().includes("oauth") ||
      String(url).toLowerCase().includes("entra");

    if (!isRelevantAuthFlow) continue;

    authRequests.push({
      eventType,
      url,
      requestId: source.id || "N/A",
      timestamp: event.time || event.timeTicks || "N/A"
    });

    const headers = params.headers || {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      if (REQUIRED_HEADERS.includes(lowerKey)) {
        detectedHeaders.push({
          header: lowerKey,
          value: value || "Present",
          eventType,
          url,
          requestId: source.id || "N/A",
          timestamp: event.time || event.timeTicks || "N/A"
        });
      }
    }
  }

  // Case 1: Headers detected
  if (detectedHeaders.length > 0) {
    const firstDetected = detectedHeaders[0];

    issues.push({
      type: "REFRESH",
      title: "Microsoft Refresh Credential Flow Detected",
      confidence: "High",
      rootCause:
        `Refresh / device credential header detected for ${firstDetected.url}`,
      reasoning:
        `TraceLens detected Microsoft refresh / device credential headers ` +
        `during browser authentication flow. Header ${firstDetected.header} ` +
        `was present in ${firstDetected.eventType}, which indicates that ` +
        `browser token refresh or device credential negotiation occurred successfully.`,
      evidence: {
        eventType: firstDetected.eventType,
        url: firstDetected.url,
        requestId: firstDetected.requestId,
        detectedHeader: firstDetected.header,
        timestamp: firstDetected.timestamp
      },
      suggestions: [
        "Refresh token flow appears healthy",
        "Verify header values if authentication still fails",
        "Check server token validation logs"
      ]
    });

    return issues;
  }

  // Case 2: Auth flow seen, but headers missing
  if (authRequests.length > 0) {
    const firstRequest = authRequests[0];

    issues.push({
      type: "REFRESH",
      title: "Refresh Credential Headers Missing",
      confidence: "Medium",
      rootCause:
        `Authentication flow detected, but refresh / device credential headers were missing`,
      reasoning:
        `TraceLens detected authentication / token-related browser requests ` +
        `to Microsoft identity endpoints, but did not find expected Microsoft ` +
        `refresh or device credential headers in the trace. This may indicate ` +
        `refresh flow did not trigger, token request failed early, or browser policy prevented header injection.`,
      evidence: {
        eventType: firstRequest.eventType,
        url: firstRequest.url,
        requestId: firstRequest.requestId,
        timestamp: firstRequest.timestamp
      },
      suggestions: [
        "Ensure trace captured full sign-in / token refresh flow",
        "Check browser policy for device auth",
        "Verify account is workplace joined / compliant",
        "Capture trace during fresh login attempt"
      ]
    });
  }

  return issues;
}

module.exports = { detectRefreshCredentialIssues };