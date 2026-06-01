import { Player, mockPlayers, currentPlayer, getRankFromElo, RankTier } from "./mockData";

// ELO ranges per tier
export const ELO_TIERS: Record<RankTier, { min: number; max: number }> = {
  Bronze: { min: 0, max: 999 },
  Prata: { min: 1000, max: 1499 },
  Ouro: { min: 1500, max: 1999 },
  Platina: { min: 2000, max: 2499 },
  Diamante: { min: 2500, max: 2999 },
  Imortal: { min: 3000, max: 9999 },
};

// Dynamic queue range expansion (in seconds)
export const QUEUE_STAGES = [
  { maxTime: 120, range: 100, label: "Match Perfeito" },
  { maxTime: 300, range: 250, label: "Match Bom" },
  { maxTime: 600, range: 500, label: "Match Aceitável" },
];

export function getQueueRange(elapsedSeconds: number, playerElo: number): { min: number; max: number; label: string } {
  for (const stage of QUEUE_STAGES) {
    if (elapsedSeconds <= stage.maxTime) {
      return {
        min: Math.max(0, playerElo - stage.range),
        max: playerElo + stage.range,
        label: stage.label,
      };
    }
  }
  return {
    min: Math.max(0, playerElo - 500),
    max: playerElo + 500,
    label: "Range Máximo",
  };
}

export function getCompatiblePlayers(playerElo: number, range: number): Player[] {
  return mockPlayers.filter(
    (p) => Math.abs(p.elo_points - playerElo) <= range && p.id !== currentPlayer.id
  );
}

// Balance 10 players into 2 teams with closest ELO totals
export function balanceTeams(players: Player[]): { team1: Player[]; team2: Player[]; diff: number } {
  // Sort by ELO descending
  const sorted = [...players].sort((a, b) => b.elo_points - a.elo_points);
  const team1: Player[] = [];
  const team2: Player[] = [];
  let sum1 = 0;
  let sum2 = 0;

  // Greedy balancing: assign each player to the team with lower total
  for (const player of sorted) {
    if (team1.length >= 5) {
      team2.push(player);
      sum2 += player.elo_points;
    } else if (team2.length >= 5) {
      team1.push(player);
      sum1 += player.elo_points;
    } else if (sum1 <= sum2) {
      team1.push(player);
      sum1 += player.elo_points;
    } else {
      team2.push(player);
      sum2 += player.elo_points;
    }
  }

  return {
    team1: team1.sort((a, b) => b.elo_points - a.elo_points),
    team2: team2.sort((a, b) => b.elo_points - a.elo_points),
    diff: Math.abs(sum1 - sum2),
  };
}

export function getTeamAvgElo(team: Player[]): number {
  if (team.length === 0) return 0;
  return Math.round(team.reduce((s, p) => s + p.elo_points, 0) / team.length);
}

export function calculateEloChange(
  playerElo: number,
  teamAvgElo: number,
  opponentAvgElo: number,
  result: "win" | "loss"
): number {
  const eloDiff = opponentAvgElo - teamAvgElo;

  if (result === "win") {
    if (eloDiff > 100) return Math.floor(Math.random() * 10) + 25; // +25 to +35
    if (eloDiff > 0) return Math.floor(Math.random() * 5) + 20; // +20 to +25
    return Math.floor(Math.random() * 5) + 15; // +15 to +20
  } else {
    if (eloDiff > 100) return -(Math.floor(Math.random() * 5) + 10); // -10 to -15
    if (eloDiff > 0) return -(Math.floor(Math.random() * 5) + 15); // -15 to -20
    return -(Math.floor(Math.random() * 5) + 25); // -25 to -30
  }
}

export function getBalanceLabel(diff: number): { label: string; color: string } {
  if (diff < 50) return { label: "PERFEITO", color: "text-win" };
  if (diff < 200) return { label: "JUSTO", color: "text-win" };
  if (diff < 400) return { label: "ACEITÁVEL", color: "text-yellow-400" };
  return { label: "DESEQUILIBRADO", color: "text-loss" };
}

// Profanity filter (basic)
const BLOCKED_WORDS = ["porra", "caralho", "merda", "fdp", "pqp", "vsf", "tnc", "krl"];

export function filterMessage(msg: string): string {
  let filtered = msg;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  }
  return filtered;
}

// Random Valorant maps
export const VALORANT_MAPS = ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl", "Lotus", "Sunset", "Abyss", "Corrode"];

export function getRandomMap(): string {
  return VALORANT_MAPS[Math.floor(Math.random() * VALORANT_MAPS.length)];
}

export function generateServerInfo() {
  const octets = Array.from({ length: 4 }, () => Math.floor(Math.random() * 255));
  return {
    ip: `${octets.join(".")}:7000`,
    password: Math.random().toString(36).substring(2, 8).toUpperCase(),
    map: getRandomMap(),
  };
}

// Simulate queue players joining over time
export function simulateQueuePlayers(elapsedSeconds: number, playerElo: number): Player[] {
  const range = getQueueRange(elapsedSeconds, playerElo);
  const compatible = getCompatiblePlayers(playerElo, range.max - playerElo);

  // Gradually add players based on elapsed time
  const maxPlayers = Math.min(9, Math.floor(elapsedSeconds / 3) + 1);
  return compatible.slice(0, Math.min(maxPlayers, compatible.length));
}
