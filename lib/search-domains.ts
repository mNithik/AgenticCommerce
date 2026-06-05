import type { AgentName, ConfidenceGapTheme } from "./types";

type ResolveSearchDomainsInput = {
  subject: string;
  agent: AgentName;
  theme?: ConfidenceGapTheme;
};

const REVIEW_AGGREGATOR_DOMAINS = ["g2.com", "trustradius.com"];

const VENDOR_DOMAIN_MAP: Record<string, string[]> = {
  "apollo.io": ["apollo.io"],
  apollo: ["apollo.io"],
  "github copilot": ["github.com", "docs.github.com", "microsoft.com"],
  github: ["github.com", "docs.github.com", "microsoft.com"],
  hubspot: ["hubspot.com"],
  leadmagic: ["leadmagic.io"],
  zoominfo: ["zoominfo.com"],
  notion: ["notion.so"],
  ramp: ["ramp.com"],
};

export const SEARCH_DOMAIN_ALLOWLISTS: Record<ConfidenceGapTheme, string[]> = {
  legal_resolution: [
    "reuters.com",
    "law360.com",
    "courtlistener.com",
    "pacermonitor.com",
    "ftc.gov",
  ],
  pricing_validation: REVIEW_AGGREGATOR_DOMAINS,
  implementation_validation: [...REVIEW_AGGREGATOR_DOMAINS, "softwareadvice.com", "capterra.com"],
  deliverability_validation: [...REVIEW_AGGREGATOR_DOMAINS, "reddit.com", "emailtooltester.com"],
  general_validation: [...REVIEW_AGGREGATOR_DOMAINS, "softwareadvice.com"],
};

function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugToDomain(subject: string) {
  const normalized = normalizeSubject(subject);
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes(".")) {
    const domain = normalized.replace(/[^a-z0-9.-]/g, "");
    return domain.includes(".") ? domain : undefined;
  }

  if (normalized.includes(" ")) {
    return undefined;
  }

  const firstToken = normalized.split(" ")[0]?.replace(/[^a-z0-9-]/g, "");
  return firstToken ? `${firstToken}.com` : undefined;
}

function resolveVendorDomains(subject: string) {
  const normalized = normalizeSubject(subject);
  const mapped = VENDOR_DOMAIN_MAP[normalized];
  if (mapped?.length) {
    return mapped;
  }

  const firstToken = normalized.split(" ")[0] ?? "";
  if (firstToken && VENDOR_DOMAIN_MAP[firstToken]?.length) {
    return VENDOR_DOMAIN_MAP[firstToken];
  }

  const heuristic = slugToDomain(subject);
  return heuristic ? [heuristic] : [];
}

export function resolveSearchDomains({
  subject,
  agent,
  theme,
}: ResolveSearchDomainsInput): string[] | undefined {
  if (agent === "Skeptic") {
    return undefined;
  }

  if (agent === "Counter" || theme === "legal_resolution") {
    return SEARCH_DOMAIN_ALLOWLISTS.legal_resolution;
  }

  const vendorDomains = resolveVendorDomains(subject);

  if (agent === "Market") {
    if (vendorDomains.length === 0) {
      return undefined;
    }
    return [...vendorDomains, ...REVIEW_AGGREGATOR_DOMAINS].slice(0, 5);
  }

  if (theme && theme in SEARCH_DOMAIN_ALLOWLISTS) {
    if (vendorDomains.length === 0) {
      return SEARCH_DOMAIN_ALLOWLISTS[theme];
    }
    return [...vendorDomains, ...SEARCH_DOMAIN_ALLOWLISTS[theme]].slice(0, 5);
  }

  return vendorDomains.length > 0 ? [...vendorDomains, ...REVIEW_AGGREGATOR_DOMAINS].slice(0, 5) : undefined;
}
