import type { SearchOptions } from "./x402-search";

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function domainMatchesQuery(query: string, domains: string[]) {
  const normalizedQuery = query.toLowerCase();
  const tokens = new Set(tokenize(query));
  return domains.some((domain) => {
    const hostToken = domain.split(".")[0]?.toLowerCase();
    return hostToken ? tokens.has(hostToken) || normalizedQuery.includes(hostToken) : false;
  });
}

export function buildTavilyBody(options: SearchOptions) {
  const includeDomains =
    Array.isArray(options.include_domains) && options.include_domains.length > 0
      ? options.include_domains.slice(0, 5)
      : undefined;

  const safeDomains =
    includeDomains && domainMatchesQuery(options.query, includeDomains)
      ? includeDomains
      : undefined;

  const body: Record<string, unknown> = {
    query: options.query,
    max_results: options.max_results ?? 5,
    include_answer: false,
  };

  if (options.search_depth) {
    body.search_depth = options.search_depth;
  }

  if (safeDomains && safeDomains.length > 0) {
    body.include_domains = safeDomains;
  }

  if (options.time_range) {
    body.time_range = options.time_range;
  }

  return body;
}

export function minimalTavilyBody(options: SearchOptions) {
  return {
    query: options.query,
    max_results: options.max_results ?? 5,
    include_answer: false,
  };
}
