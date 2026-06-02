import crypto from "node:crypto";

export function normalizeQuery(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function slugify(value: string) {
  return normalizeQuery(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function makeId(prefix: string, seed: string) {
  return `${prefix}_${hashText(seed)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function asMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
