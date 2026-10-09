export interface OpenFootballMatch {
  round: string;
  date: string;
  team1: string;
  team2: string;
  score?: {
    ft?: [number, number];
  };
}

export interface OpenFootballResponse {
  name: string;
  matches: OpenFootballMatch[];
}

export async function fetchOpenFootballMatches(repo: string, file: string): Promise<OpenFootballMatch[]> {
  const url = `https://raw.githubusercontent.com/openfootball/${repo}/master/${file}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as OpenFootballResponse;
    return data.matches || [];
  } catch {
    return [];
  }
}
