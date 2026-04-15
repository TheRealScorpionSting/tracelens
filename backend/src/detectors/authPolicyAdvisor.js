function getAuthPolicyAdvice({
  hostname = "Unknown",
  authType = "",
  privateMode = false,
  isDelegation = false,
  isProxyAuth = false
} = {}) {
  const domain = getDomain(hostname);

  const policyRelevance = [];
  const technicalFix = [];

  /* =========================================
     AuthServerAllowlist
  ========================================= */
  policyRelevance.push(
    `AuthServerAllowlist controls whether Chromium / Edge automatically sends integrated authentication to ${hostname}.`
  );

  technicalFix.push(
    `Add ${hostname} or *.${domain} to AuthServerAllowlist.`
  );

  /* =========================================
     AuthSchemes
  ========================================= */
  if (/ntlm|negotiate|kerberos/i.test(authType)) {
    policyRelevance.push(
      `AuthSchemes policy must allow ${authType} for seamless authentication.`
    );

    technicalFix.push(
      "Ensure AuthSchemes includes negotiate,ntlm."
    );
  }

  /* =========================================
     Kerberos delegation
  ========================================= */
  if (isDelegation) {
    policyRelevance.push(
      `AuthNegotiateDelegateAllowlist controls Kerberos delegation for ${hostname}.`
    );

    technicalFix.push(
      `Add *.${domain} to AuthNegotiateDelegateAllowlist if double-hop / downstream access is needed.`
    );
  }

  /* =========================================
     Proxy auth
  ========================================= */
  if (isProxyAuth) {
    policyRelevance.push(
      "Proxy authentication may interrupt ambient browser authentication."
    );

    technicalFix.push(
      "Validate proxy bypass / PAC rules for IdP and intranet URLs."
    );

    technicalFix.push(
      "Ensure proxy supports negotiate / ntlm pass-through."
    );
  }

  /* =========================================
     Private Mode auth
  ========================================= */
  if (privateMode) {
    policyRelevance.push(
      "Private browsing may suppress ambient authentication."
    );

    technicalFix.push(
      "Enable AmbientAuthenticationInPrivateModesEnabled if required."
    );

    technicalFix.push(
      "Retest in normal browsing mode."
    );
  }

  /* =========================================
     Kerberos SPN / CNAME
  ========================================= */
  if (/kerberos|negotiate/i.test(authType)) {
    policyRelevance.push(
      "Kerberos may fail due to SPN mismatch, CNAME lookup, or DNS aliasing."
    );

    technicalFix.push(
      "Validate SPN registration on service account."
    );

    technicalFix.push(
      "Review DisableAuthNegotiateCnameLookup if using DNS aliases."
    );

    technicalFix.push(
      "Verify client device is domain / hybrid joined."
    );
  }

  /* =========================================
     Cleanup duplicates
  ========================================= */
  return {
    policyRelevance: [...new Set(policyRelevance)],
    technicalFix: [...new Set(technicalFix)]
  };
}

/* =========================================
   HELPERS
========================================= */
function getDomain(hostname) {
  if (!hostname || hostname === "Unknown") {
    return "yourdomain.com";
  }

  const parts = hostname.split(".");
  return parts.length >= 2
    ? parts.slice(-2).join(".")
    : hostname;
}

module.exports = {
  getAuthPolicyAdvice
};