import { extractNbaTeamAbbrs } from "./nba/team-aliases.js";

const DATE_WORDS =
  /\b(yesterday|today|tonight|last night|ce soir|hier|aujourd'hui)\b/i;

const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export type ParsedGameQuery = {
  raw: string;
  /** YYYY-MM-DD in local calendar */
  dates: string[];
  nbaTeamAbbrs: string[];
  hasRelativeDate: boolean;
  isFootballHint: boolean;
  footTeamHints: string[];
};

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

/** Resolve relative / absolute date hints from natural language. */
export function parseGameDates(text: string, now = new Date()): string[] {
  const q = text.toLowerCase();
  const dates = new Set<string>();

  if (/\b(today|tonight|ce soir|aujourd'hui)\b/i.test(q)) {
    dates.add(formatYmd(now));
  }
  if (/\b(yesterday|last night|hier)\b/i.test(q)) {
    dates.add(formatYmd(addDays(now, -1)));
  }

  const iso = q.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) dates.add(`${iso[1]}-${iso[2]}-${iso[3]}`);

  const slash = q.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slash) {
    const mm = slash[1].padStart(2, "0");
    const dd = slash[2].padStart(2, "0");
    dates.add(`${slash[3]}-${mm}-${dd}`);
  }

  const dayMonth = q.match(
    /\b(\d{1,2})(?:er)?\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)(?:,?\s*(20\d{2}))?\b/i
  );
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthKey = dayMonth[2].toLowerCase();
    const month = MONTHS[monthKey];
    if (month !== undefined) {
      const year = dayMonth[3] ? Number(dayMonth[3]) : now.getFullYear();
      dates.add(formatYmd(new Date(year, month, day)));
    }
  }

  const named = q.match(
    /\b(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:,?\s*(20\d{2}))?\b/i
  );
  if (named) {
    const monthKey = named[1].toLowerCase();
    const month = MONTHS[monthKey];
    if (month !== undefined) {
      const day = Number(named[2]);
      const year = named[3] ? Number(named[3]) : now.getFullYear();
      dates.add(formatYmd(new Date(year, month, day)));
    }
  }

  if (dates.size > 0) return [...dates];

  return [formatYmd(now), formatYmd(addDays(now, -1))];
}

export function parseNaturalGameQuery(query: string, now = new Date()): ParsedGameQuery {
  const raw = query.trim();
  const dates = parseGameDates(raw, now);
  const hasRelativeDate = DATE_WORDS.test(raw);
  const nbaTeamAbbrs = extractNbaTeamAbbrs(raw);
  const footKeywords = /\b(psg|paris|inter|real|barça|barca|bayern|juve|juventus|liverpool|arsenal|chelsea|city|united|ac milan|milan|dortmund|atletico|tottenham|madrid|munich)\b/gi;
  const footMatches = raw.match(footKeywords) || [];
  const footTeamHints = [...new Set(footMatches)];
  const isFootballHint = footTeamHints.length > 0;

  return { raw, dates, nbaTeamAbbrs, hasRelativeDate, isFootballHint, footTeamHints };
}

export function needsExternalDiscovery(parsed: ParsedGameQuery): boolean {
  return (
    parsed.hasRelativeDate ||
    parsed.nbaTeamAbbrs.length >= 2 ||
    parsed.isFootballHint ||
    parsed.dates.length > 0
  );
}
