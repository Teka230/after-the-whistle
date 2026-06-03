/** NBA team alias groups — any alias in a group resolves to the same abbreviation. */
export type NbaTeamGroup = {
  abbr: string;
  aliases: string[];
};

export const NBA_TEAM_GROUPS: NbaTeamGroup[] = [
  { abbr: "ATL", aliases: ["hawks", "atlanta", "atl"] },
  { abbr: "BOS", aliases: ["celtics", "boston", "bos"] },
  { abbr: "BKN", aliases: ["nets", "brooklyn", "bkn", "brooklyn nets"] },
  { abbr: "CHA", aliases: ["hornets", "charlotte", "cha"] },
  { abbr: "CHI", aliases: ["bulls", "chicago", "chi"] },
  { abbr: "CLE", aliases: ["cavaliers", "cavs", "cleveland", "cle"] },
  { abbr: "DAL", aliases: ["mavericks", "mavs", "dallas", "dal"] },
  { abbr: "DEN", aliases: ["nuggets", "denver", "den"] },
  { abbr: "DET", aliases: ["pistons", "detroit", "det"] },
  { abbr: "GSW", aliases: ["warriors", "golden state", "gsw", "gs"] },
  { abbr: "HOU", aliases: ["rockets", "houston", "hou"] },
  { abbr: "IND", aliases: ["pacers", "indiana", "ind"] },
  { abbr: "LAC", aliases: ["clippers", "la clippers", "lac"] },
  { abbr: "LAL", aliases: ["lakers", "la lakers", "los angeles lakers", "lal"] },
  { abbr: "MEM", aliases: ["grizzlies", "memphis", "mem"] },
  { abbr: "MIA", aliases: ["heat", "miami", "mia"] },
  { abbr: "MIL", aliases: ["bucks", "milwaukee", "mil"] },
  { abbr: "MIN", aliases: ["timberwolves", "wolves", "minnesota", "min"] },
  { abbr: "NOP", aliases: ["pelicans", "new orleans", "nop", "no"] },
  { abbr: "NYK", aliases: ["knicks", "new york knicks", "nyk", "ny"] },
  { abbr: "OKC", aliases: ["thunder", "okc", "oklahoma city", "oklahoma"] },
  { abbr: "ORL", aliases: ["magic", "orlando", "orl"] },
  { abbr: "PHI", aliases: ["sixers", "76ers", "philadelphia", "phi"] },
  { abbr: "PHX", aliases: ["suns", "phoenix", "phx"] },
  { abbr: "POR", aliases: ["blazers", "trail blazers", "portland", "por"] },
  { abbr: "SAC", aliases: ["kings", "sacramento", "sac"] },
  { abbr: "SAS", aliases: ["spurs", "san antonio", "sas"] },
  { abbr: "TOR", aliases: ["raptors", "toronto", "tor"] },
  { abbr: "UTA", aliases: ["jazz", "utah", "uta"] },
  { abbr: "WAS", aliases: ["wizards", "washington", "was", "wsh"] },
];

export type NbaTeamInfo = {
  id: number;
  abbr: string;
  city: string;
  name: string;
};

export const NBA_TEAMS: NbaTeamInfo[] = [
  { id: 1610612737, abbr: "ATL", city: "Atlanta", name: "Hawks" },
  { id: 1610612738, abbr: "BOS", city: "Boston", name: "Celtics" },
  { id: 1610612751, abbr: "BKN", city: "Brooklyn", name: "Nets" },
  { id: 1610612766, abbr: "CHA", city: "Charlotte", name: "Hornets" },
  { id: 1610612741, abbr: "CHI", city: "Chicago", name: "Bulls" },
  { id: 1610612739, abbr: "CLE", city: "Cleveland", name: "Cavaliers" },
  { id: 1610612742, abbr: "DAL", city: "Dallas", name: "Mavericks" },
  { id: 1610612743, abbr: "DEN", city: "Denver", name: "Nuggets" },
  { id: 1610612765, abbr: "DET", city: "Detroit", name: "Pistons" },
  { id: 1610612744, abbr: "GSW", city: "Golden State", name: "Warriors" },
  { id: 1610612745, abbr: "HOU", city: "Houston", name: "Rockets" },
  { id: 1610612754, abbr: "IND", city: "Indiana", name: "Pacers" },
  { id: 1610612746, abbr: "LAC", city: "LA", name: "Clippers" },
  { id: 1610612747, abbr: "LAL", city: "Los Angeles", name: "Lakers" },
  { id: 1610612763, abbr: "MEM", city: "Memphis", name: "Grizzlies" },
  { id: 1610612748, abbr: "MIA", city: "Miami", name: "Heat" },
  { id: 1610612749, abbr: "MIL", city: "Milwaukee", name: "Bucks" },
  { id: 1610612750, abbr: "MIN", city: "Minnesota", name: "Timberwolves" },
  { id: 1610612740, abbr: "NOP", city: "New Orleans", name: "Pelicans" },
  { id: 1610612752, abbr: "NYK", city: "New York", name: "Knicks" },
  { id: 1610612760, abbr: "OKC", city: "Oklahoma City", name: "Thunder" },
  { id: 1610612753, abbr: "ORL", city: "Orlando", name: "Magic" },
  { id: 1610612755, abbr: "PHI", city: "Philadelphia", name: "76ers" },
  { id: 1610612756, abbr: "PHX", city: "Phoenix", name: "Suns" },
  { id: 1610612757, abbr: "POR", city: "Portland", name: "Trail Blazers" },
  { id: 1610612758, abbr: "SAC", city: "Sacramento", name: "Kings" },
  { id: 1610612759, abbr: "SAS", city: "San Antonio", name: "Spurs" },
  { id: 1610612761, abbr: "TOR", city: "Toronto", name: "Raptors" },
  { id: 1610612762, abbr: "UTA", city: "Utah", name: "Jazz" },
  { id: 1610612764, abbr: "WAS", city: "Washington", name: "Wizards" },
];

const teamById = new Map(NBA_TEAMS.map((team) => [team.id, team]));
const teamByAbbr = new Map(NBA_TEAMS.map((team) => [team.abbr, team]));

export function nbaTeamById(id: number | string | undefined): NbaTeamInfo | undefined {
  const n = Number(id);
  if (!Number.isFinite(n)) return undefined;
  return teamById.get(n);
}

export function nbaTeamByAbbr(abbr: string | undefined): NbaTeamInfo | undefined {
  const key = abbr?.trim().toUpperCase();
  return key ? teamByAbbr.get(key) : undefined;
}

export function nbaTeamDisplayName(input: {
  id?: number | string;
  abbr?: string;
  city?: unknown;
  name?: unknown;
  fallbackName: string;
}): string {
  const info = nbaTeamById(input.id) ?? nbaTeamByAbbr(input.abbr);
  const city = String(input.city ?? "").trim();
  const name = String(input.name ?? "").trim();
  const raw = `${city} ${name}`.trim();
  if (info) return `${info.city} ${info.name}`;
  if (raw && !/\b(home|away)\b/i.test(raw)) return raw;
  return input.fallbackName;
}

export function nbaTeamAbbr(input: {
  id?: number | string;
  abbr?: string;
  fallback: string;
}): string {
  const raw = input.abbr?.trim().toUpperCase();
  if (raw) return raw;
  return nbaTeamById(input.id)?.abbr ?? input.fallback;
}

const aliasToAbbr = new Map<string, string>();
for (const g of NBA_TEAM_GROUPS) {
  for (const a of g.aliases) {
    aliasToAbbr.set(a.toLowerCase(), g.abbr);
  }
  aliasToAbbr.set(g.abbr.toLowerCase(), g.abbr);
}

/** Teams mentioned in free text (deduped by abbreviation). */
export function extractNbaTeamAbbrs(text: string): string[] {
  const q = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const found = new Set<string>();

  const sorted = [...aliasToAbbr.entries()].sort((a, b) => b[0].length - a[0].length);
  let remaining = ` ${q} `;
  for (const [alias, abbr] of sorted) {
    const needle = ` ${alias} `;
    if (remaining.includes(needle)) {
      found.add(abbr);
      remaining = remaining.split(needle).join(" ");
    }
  }
  return [...found];
}

export function rowMatchesTeams(
  homeAbbr: string,
  awayAbbr: string,
  homeName: string,
  awayName: string,
  requiredAbbrs: string[]
): boolean {
  if (requiredAbbrs.length === 0) return true;
  const hay = `${homeAbbr} ${awayAbbr} ${homeName} ${awayName}`.toLowerCase();
  return requiredAbbrs.every((abbr) => {
    const g = NBA_TEAM_GROUPS.find((t) => t.abbr === abbr);
    if (!g) return hay.includes(abbr.toLowerCase());
    return (
      hay.includes(abbr.toLowerCase()) ||
      g.aliases.some((a) => hay.includes(a))
    );
  });
}
