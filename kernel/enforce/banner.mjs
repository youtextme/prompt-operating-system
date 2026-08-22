/**
 * First-line disclosure.
 *
 * Contract with the human:
 *   - A prompt that went through POS starts with BANNER_ROUTED, verbatim.
 *   - A prompt that did NOT go through POS still answers (prompts never fail)
 *     but its first line says so, names the reason, and states that POS claim
 *     gates stay closed.
 *   - The banner is only allowed to appear when a verifiable attestation backs
 *     it. A model that prints the banner itself gets it stripped and replaced
 *     by the degraded line — the banner is evidence, not decoration.
 */
import { verifyAttestation } from "./attest.mjs";

export const BANNER_ROUTED = "Prompt Operating System at Play. We'll get you the outcomes you need.";
export const BANNER_DEGRADED_PREFIX = "Prompt Operating System NOT at play";
const MARKER_RE = /^<!--\s*pos:(routed|degraded)\s+attest:([A-Za-z0-9_-]+)\s+sig:([a-f0-9]{12})\s*-->$/;

export function degradedBanner(reason) {
  return `${BANNER_DEGRADED_PREFIX} — this prompt was not routed through the kernel (reason: ${reason || "unknown"}). Answer continues unverified; "done"/"proven" claims stay blocked until \`pos route --repair\` passes.`;
}

export function bannerMarker(state, attestationId, signature) {
  return `<!-- pos:${state} attest:${attestationId || "none"} sig:${(signature || "").slice(0, 12) || "000000000000"} -->`;
}

/** Remove any POS banner or marker line the model may have written itself. */
export function stripBanner(text) {
  const lines = String(text ?? "").split("\n");
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (t === BANNER_ROUTED) return false;
    if (t.startsWith(BANNER_DEGRADED_PREFIX)) return false;
    if (MARKER_RE.test(t)) return false;
    return true;
  });
  while (kept.length && kept[0].trim() === "") kept.shift();
  return kept.join("\n");
}

/**
 * Put the correct first line on a response.
 * `state.routed` must come from an attestation the kernel issued, not from the model.
 */
export function applyBanner(text, state = {}) {
  const body = stripBanner(text);
  const routed = state.routed === true;
  const head = routed ? BANNER_ROUTED : degradedBanner(state.reason);
  const marker = bannerMarker(routed ? "routed" : "degraded", state.attestationId, state.signature);
  return [head, marker, "", body].join("\n").replace(/\n{3,}$/, "\n");
}

export function readBannerState(text) {
  const lines = String(text ?? "").split("\n");
  const first = (lines[0] || "").trim();
  const marker = lines.slice(0, 4).map((l) => l.trim()).find((l) => MARKER_RE.test(l));
  const m = marker ? marker.match(MARKER_RE) : null;
  return {
    firstLine: first,
    claimsRouted: first === BANNER_ROUTED,
    declaresDegraded: first.startsWith(BANNER_DEGRADED_PREFIX),
    markerState: m ? m[1] : null,
    attestationId: m ? m[2] : null,
    markerSig: m ? m[3] : null,
  };
}

/**
 * Anti-forgery: a response claiming "at Play" must carry an attestation that
 * verifies against the ledger. Otherwise the claim is forged and gets rewritten.
 */
export function enforceBanner(text, root) {
  const state = readBannerState(text);
  if (!state.claimsRouted) {
    if (state.declaresDegraded) return { text, forged: false, routed: false };
    return { text: applyBanner(text, { routed: false, reason: "no-banner" }), forged: false, routed: false };
  }
  const check = verifyAttestation(state.attestationId, root);
  if (!check.ok || check.state !== "routed" || check.signature.slice(0, 12) !== state.markerSig) {
    return {
      text: applyBanner(text, { routed: false, reason: `forged-banner (${check.reason})` }),
      forged: true,
      routed: false,
    };
  }
  return { text, forged: false, routed: true };
}
