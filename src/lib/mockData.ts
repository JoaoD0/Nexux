export type RankTier = "Bronze" | "Prata" | "Ouro" | "Platina" | "Diamante" | "Imortal";

export interface Player {
  id: string;
  nickname: string;
  avatar_url: string;
  elo_points: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  region: string;
  rank: RankTier;
  division: 1 | 2 | 3;
}

export interface Match {
  id: string;
  map_name: string;
  date: string;
  result: "win" | "loss";
  kills: number;
  deaths: number;
  assists: number;
  elo_change: number;
  score: string;
}

export function getRankFromElo(elo: number): { rank: RankTier; division: 1 | 2 | 3 } {
  if (elo >= 2500) return { rank: "Imortal", division: elo >= 2800 ? 3 : elo >= 2650 ? 2 : 1 };
  if (elo >= 2000) return { rank: "Diamante", division: elo >= 2350 ? 3 : elo >= 2175 ? 2 : 1 };
  if (elo >= 1600) return { rank: "Platina", division: elo >= 1875 ? 3 : elo >= 1735 ? 2 : 1 };
  if (elo >= 1300) return { rank: "Ouro", division: elo >= 1500 ? 3 : elo >= 1400 ? 2 : 1 };
  if (elo >= 1000) return { rank: "Prata", division: elo >= 1200 ? 3 : elo >= 1100 ? 2 : 1 };
  return { rank: "Bronze", division: elo >= 800 ? 3 : elo >= 600 ? 2 : 1 };
}

export function getRankColor(rank: RankTier): string {
  const map: Record<RankTier, string> = {
    Bronze: "text-rank-bronze",
    Prata: "text-rank-silver",
    Ouro: "text-rank-gold",
    Platina: "text-rank-platinum",
    Diamante: "text-rank-diamond",
    Imortal: "text-rank-immortal",
  };
  return map[rank];
}

const avatars = [
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=1",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=2",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=3",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=4",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=5",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=6",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=7",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=8",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=9",
  "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=10",
];

const nicknames = [
  "xFalleN", "aspas_br", "Less_LOUD", "cauanzin", "saadhak",
  "pancada_", "tuyz_gg", "mwzera", "heat_cs", "qck_vp",
  "dgzin", "xand_fury", "havoc_br", "nzr_kru", "mazin_gg",
  "bnj_leviathan", "sacy_dev", "raafa_kng", "frz_storm", "kon4n",
];

const regions = ["SP", "RJ", "MG", "RS", "PR", "BA", "SC", "PE"];
const maps = ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl", "Lotus", "Sunset"];

function generatePlayers(): Player[] {
  return nicknames.map((nick, i) => {
    const elo = Math.floor(Math.random() * 2000) + 500;
    const { rank, division } = getRankFromElo(elo);
    const wins = Math.floor(Math.random() * 200) + 20;
    const losses = Math.floor(Math.random() * 150) + 10;
    return {
      id: `player-${i}`,
      nickname: nick,
      avatar_url: avatars[i % avatars.length],
      elo_points: elo,
      wins,
      losses,
      kills: Math.floor(Math.random() * 3000) + 500,
      deaths: Math.floor(Math.random() * 2500) + 400,
      region: regions[i % regions.length],
      rank,
      division,
    };
  }).sort((a, b) => b.elo_points - a.elo_points);
}

function generateMatches(): Match[] {
  return Array.from({ length: 15 }, (_, i) => {
    const isWin = Math.random() > 0.45;
    const kills = Math.floor(Math.random() * 25) + 5;
    const deaths = Math.floor(Math.random() * 20) + 3;
    const assists = Math.floor(Math.random() * 10);
    const eloChange = isWin ? Math.floor(Math.random() * 20) + 10 : -(Math.floor(Math.random() * 20) + 10);
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      id: `match-${i}`,
      map_name: maps[Math.floor(Math.random() * maps.length)],
      date: d.toISOString(),
      result: isWin ? "win" : "loss",
      kills,
      deaths,
      assists,
      elo_change: eloChange,
      score: isWin ? "13-" + Math.floor(Math.random() * 12) : Math.floor(Math.random() * 12) + "-13",
    };
  });
}

export const mockPlayers = generatePlayers();
export const mockMatches = generateMatches();

export const currentPlayer: Player = {
  id: "current",
  nickname: "SeuNick",
  avatar_url: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=current",
  elo_points: 1750,
  wins: 142,
  losses: 98,
  kills: 2847,
  deaths: 2103,
  region: "SP",
  rank: "Platina",
  division: 2,
};
