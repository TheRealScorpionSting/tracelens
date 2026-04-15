// backend/src/services/correlationEngine.js

function correlateIssues(issues) {
  let rootCause = "No major issues detected";
  let confidence = "Low";

  const hasDNS = issues.some(i => i.type === "DNS");
  const hasTLS = issues.some(i => i.type === "TLS");
  const hasProxy = issues.some(i => i.type === "PROXY");
  const hasAuth = issues.some(i => i.type === "AUTH");
  const hasNTLM = issues.some(i => i.type === "NTLM");
  const hasKerberos = issues.some(i => i.type === "KERBEROS");

  // 🔥 Rules (this is your intelligence layer)

  if (hasDNS) {
    rootCause = "DNS resolution failure is blocking network requests";
    confidence = "High";
  }

  else if (hasProxy && hasTLS) {
    rootCause = "TLS failure likely caused by proxy SSL inspection";
    confidence = "High";
  }

  else if (hasProxy && !hasTLS) {
    rootCause = "Proxy connectivity issue";
    confidence = "High";
  }

  else if (hasTLS && !hasProxy) {
    rootCause = "TLS handshake or certificate issue";
    confidence = "High";
  }

  else if (hasKerberos && hasNTLM) {
    rootCause = "Kerberos failure causing fallback to NTLM";
    confidence = "High";
  }

  else if (hasNTLM) {
    rootCause = "NTLM authentication issue or misconfiguration";
    confidence = "Medium";
  }

  else if (hasAuth) {
    rootCause = "Authentication failure or session issue";
    confidence = "Medium";
  }

  return {
    rootCause,
    confidence
  };
}

module.exports = { correlateIssues };

/*
TraceLens
Created by Hariprasad Raghavan
© 2026 Hariprasad Raghavan. All Rights Reserved.
Unauthorized copying, distribution, or commercial use prohibited.
*/