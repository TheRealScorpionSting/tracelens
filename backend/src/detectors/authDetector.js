function detectAuthIssues(events = []) {
  try {
    const issues = [];

    const authChallengeEvents = [];
    const authHeaderEvents = [];
    const kerberosEvents = [];
    const ntlmEvents = [];
    const proxyAuthEvents = [];
    const privateModeAuthEvents = [];
    const delegationCandidates = [];

    for (const event of events) {
      const eventType = String(event.type || "");
      const params = event.params || {};
      const headers = normalizeHeaders(params.headers || {});
      const url =
        params.url ||
        params.request_url ||
        params.original_url ||
        "";
      const hostname = extractHostname(url);

      const evidenceBase = {
        eventType,
        url,
        hostname,
        requestId: event.source?.id || "Unknown",
        timestamp: event.time || "Unknown"
      };

      // WWW-Authenticate / Proxy auth challenge
      const wwwAuth =
        headers["www-authenticate"] ||
        headers["proxy-authenticate"] ||
        params.auth_challenge ||
        "";

      if (
        wwwAuth &&
        /(negotiate|ntlm|kerberos|basic)/i.test(wwwAuth)
      ) {
        authChallengeEvents.push({
          ...evidenceBase,
          challenge: wwwAuth
        });

        if (/proxy/i.test(wwwAuth)) {
          proxyAuthEvents.push({
            ...evidenceBase,
            challenge: wwwAuth
          });
        }

        if (/negotiate|kerberos/i.test(wwwAuth)) {
          kerberosEvents.push({
            ...evidenceBase,
            challenge: wwwAuth
          });
        }

        if (/ntlm/i.test(wwwAuth)) {
          ntlmEvents.push({
            ...evidenceBase,
            challenge: wwwAuth
          });
        }
      }

      // Authorization sent?
      const authorizationHeader =
        headers["authorization"] ||
        headers["proxy-authorization"] ||
        "";

      if (authorizationHeader) {
        authHeaderEvents.push({
          ...evidenceBase,
          authSent: authorizationHeader
        });
      }

      // Kerberos delegation candidate
      if (
        authorizationHeader &&
        /negotiate/i.test(authorizationHeader)
      ) {
        delegationCandidates.push({
          ...evidenceBase,
          authSent: authorizationHeader
        });
      }

      // InPrivate / private clues
      if (
        /incognito|private|inprivate/i.test(url) ||
        /inprivate/i.test(eventType)
      ) {
        privateModeAuthEvents.push(evidenceBase);
      }
    }

    /* =========================================
       SCENARIO 1: Integrated Auth Not Attempted
    ========================================= */
    if (
      authChallengeEvents.length > 0 &&
      authHeaderEvents.length === 0
    ) {
      const sample = authChallengeEvents[0];

      issues.push({
        type: "AUTH",
        title: "Integrated Authentication Not Attempted",
        confidence: "High",
        rootCause:
          "Server issued authentication challenge but browser did not send Authorization header.",
        reasoning:
          `TraceLens detected ${authChallengeEvents.length} authentication challenge event(s) for ${sample.hostname}, but no Authorization header was observed. This indicates ambient authentication was not triggered. Chromium / Edge typically require the host to be trusted for automatic Kerberos / NTLM authentication.`,
        evidence: {
          challengeType: sample.challenge,
          hostname: sample.hostname,
          url: sample.url,
          eventType: sample.eventType,
          requestId: sample.requestId,
          timestamp: sample.timestamp
        },
        policyRelevance: [
          "AuthServerAllowlist may not include this hostname.",
          "AuthSchemes may not allow Negotiate / NTLM.",
          "Browser may treat site as Internet zone."
        ],
        suggestions: [
          `Add ${sample.hostname} or *.${getDomain(sample.hostname)} to AuthServerAllowlist.`,
          "Ensure AuthSchemes includes negotiate,ntlm.",
          "Verify device is domain joined / Entra hybrid joined.",
          "Check intranet zone detection / proxy path."
        ]
      });
    }

    /* =========================================
       SCENARIO 2: NTLM Loop / 401 Loop
    ========================================= */
    if (
      ntlmEvents.length >= 2 &&
      authHeaderEvents.length > 0
    ) {
      const sample = ntlmEvents[0];

      issues.push({
        type: "AUTH",
        title: "NTLM / Authentication Challenge Loop Detected",
        confidence: "High",
        rootCause:
          "Repeated NTLM / challenge negotiation loop without successful completion.",
        reasoning:
          `TraceLens observed repeated NTLM / challenge flow for ${sample.hostname}. Browser attempted authentication, but server continued issuing challenges. This typically indicates credential rejection, SPN mismatch, channel binding issue, or proxy interference.`,
        evidence: {
          hostname: sample.hostname,
          url: sample.url,
          totalChallenges: ntlmEvents.length,
          totalAuthAttempts: authHeaderEvents.length,
          requestId: sample.requestId
        },
        policyRelevance: [
          "AuthSchemes must allow ntlm.",
          "Proxy auth may be interfering.",
          "Extended Protection / CBT may block auth."
        ],
        suggestions: [
          "Verify user credentials and account lock status.",
          "Ensure AuthSchemes allows ntlm.",
          "Check if proxy injects additional auth challenge.",
          "Validate SPN / IIS Windows Auth configuration.",
          "Review Extended Protection / Channel Binding settings."
        ]
      });
    }

    /* =========================================
       SCENARIO 3: Kerberos Delegation Block
    ========================================= */
    if (
      delegationCandidates.length > 0 &&
      kerberosEvents.length > 0
    ) {
      const sample = delegationCandidates[0];

      issues.push({
        type: "AUTH",
        title: "Kerberos Delegation May Be Blocked",
        confidence: "Medium",
        rootCause:
          "Kerberos authentication observed, but delegation scenario may require allowlist.",
        reasoning:
          `TraceLens detected Kerberos / Negotiate flow for ${sample.hostname}. If this application performs downstream access (double-hop), delegated credentials may not be forwarded unless browser delegation allowlist is configured.`,
        evidence: {
          hostname: sample.hostname,
          url: sample.url,
          authHeaderDetected: "Negotiate",
          requestId: sample.requestId
        },
        policyRelevance: [
          "AuthNegotiateDelegateAllowlist controls delegated Kerberos credentials."
        ],
        suggestions: [
          `Add *.${getDomain(sample.hostname)} to AuthNegotiateDelegateAllowlist if delegation is required.`,
          "Verify backend constrained delegation configuration.",
          "Validate SPN registration.",
          "Check KCD / service trust settings."
        ]
      });
    }

    /* =========================================
       SCENARIO 4: Proxy Auth Interference
    ========================================= */
    if (proxyAuthEvents.length > 0) {
      const sample = proxyAuthEvents[0];

      issues.push({
        type: "AUTH",
        title: "Proxy Authentication Challenge Detected",
        confidence: "Medium",
        rootCause:
          "Proxy authentication may be interfering with seamless sign-in.",
        reasoning:
          `TraceLens detected proxy authentication challenge(s) while accessing ${sample.hostname}. Proxy auth may interrupt Kerberos / NTLM negotiation with destination server.`,
        evidence: {
          hostname: sample.hostname,
          url: sample.url,
          proxyChallenge: sample.challenge,
          requestId: sample.requestId
        },
        policyRelevance: [
          "Proxy auth path may affect integrated auth.",
          "AuthSchemes should allow proxy-supported schemes."
        ],
        suggestions: [
          "Check PAC / proxy authentication flow.",
          "Validate proxy bypass for intranet / IdP.",
          "Ensure proxy allows negotiate / ntlm pass-through."
        ]
      });
    }

    /* =========================================
       SCENARIO 5: InPrivate auth suppression
    ========================================= */
    if (privateModeAuthEvents.length > 0) {
      const sample = privateModeAuthEvents[0];

      issues.push({
        type: "AUTH",
        title: "Authentication May Be Suppressed in Private Mode",
        confidence: "Low",
        rootCause:
          "Private browsing mode may suppress ambient authentication.",
        reasoning:
          `TraceLens detected private browsing indicators during authentication flow for ${sample.hostname}. Chromium / Edge may suppress automatic integrated auth unless policy explicitly allows it.`,
        evidence: {
          hostname: sample.hostname,
          url: sample.url,
          eventType: sample.eventType
        },
        policyRelevance: [
          "AmbientAuthenticationInPrivateModesEnabled controls private mode auth."
        ],
        suggestions: [
          "Enable AmbientAuthenticationInPrivateModesEnabled if needed.",
          "Retest in normal browser mode.",
          "Verify browser policy inheritance."
        ]
      });
    }

    return issues;
  } catch (error) {
    console.error(
      "Auth detector error:",
      error.message
    );
    return [];
  }
}

/* =========================================
   HELPERS
========================================= */
function normalizeHeaders(headers) {
  const normalized = {};

  if (Array.isArray(headers)) {
    headers.forEach((header) => {
      if (header.name) {
        normalized[header.name.toLowerCase()] =
          header.value || "";
      }
    });
  } else {
    Object.keys(headers || {}).forEach((key) => {
      normalized[key.toLowerCase()] = headers[key];
    });
  }

  return normalized;
}

function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Unknown";
  }
}

function getDomain(hostname) {
  if (!hostname || hostname === "Unknown") {
    return "yourdomain.com";
  }

  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
}

module.exports = detectAuthIssues;