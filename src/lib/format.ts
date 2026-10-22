import type { Locale } from "@/domain/enums";
import { INTL_LOCALE } from "./locale";

export function formatDate(value: Date | string | null | undefined, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], opts).format(d);
}

export function formatDateTime(value: Date | string | null | undefined, locale: Locale): string {
  return formatDate(value, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], opts).format(n);
}

export function formatBytes(n: number | null | undefined, locale: Locale): string {
  if (n == null) return "";
  if (n < 1024) return `${formatNumber(n, locale)} B`;
  if (n < 1024 * 1024) return `${formatNumber(n / 1024, locale, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(n / (1024 * 1024), locale, { maximumFractionDigits: 1 })} MB`;
}

export function formatUsd(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 3 : 2 }).format(n);
}
