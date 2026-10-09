export interface EspnScoreboardResponse {
  events: EspnEvent[];
}

export interface EspnEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      state: string; // "pre", "in", "post"
      shortDetail: string; // "FT", "HT", etc.
    };
  };
  competitions: {
    competitors: {
      id: string;
      homeAway: string;
      score: string;
      team: {
        id: string;
        name: string;
        abbreviation: string;
        displayName: string;
      };
    }[];
  }[];
}

export interface EspnSummaryResponse {
  header: {
    id: string;
    competitions: {
      competitors: {
        id: string;
        homeAway: string;
        score: string;
        team: {
          id: string;
          name: string;
          abbreviation: string;
        };
      }[];
      status: {
        type: {
          state: string;
          shortDetail: string;
        };
      };
      date: string;
    }[];
  };
  boxscore: {
    teams: {
      team: { id: string; name: string };
      statistics: {
        name: string;
        displayValue: string;
        label: string;
      }[];
    }[];
  };
  rosters: {
    team: { id: string; name: string };
    roster: {
      athlete: { id: string; displayName: string };
      stats: Record<string, string>; // Sometimes espn gives stats directly, or an array. We will parse it dynamically.
    }[];
  }[];
  keyEvents: {
    id: string;
    text: string;
    shortText: string;
    clock: { displayValue: string };
    type: { text: string }; // "Goal", "Yellow Card", "Substitution"
    team: { id: string };
    participants: { athlete: { id: string } }[];
  }[];
}

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export async function fetchEspnScoreboard(league: string, date?: string): Promise<EspnScoreboardResponse> {
  const url = `${BASE}/${league}/scoreboard${date ? `?dates=${date}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN Scoreboard Error: ${res.status}`);
  return res.json() as Promise<EspnScoreboardResponse>;
}

export async function fetchEspnSummary(league: string, eventId: string): Promise<EspnSummaryResponse> {
  const url = `${BASE}/${league}/summary?event=${eventId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN Summary Error: ${res.status}`);
  return res.json() as Promise<EspnSummaryResponse>;
}
