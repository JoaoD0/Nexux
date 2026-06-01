import { Layout } from "@/components/Layout";
import { PlayerRow } from "@/components/PlayerRow";
import { RankTier } from "@/lib/mockData";
import { useLeaderboard } from "@/hooks/useProfile";
import { Trophy, Search, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";

const tiers: (RankTier | "Todos")[] = ["Todos", "Imortal", "Diamante", "Platina", "Ouro", "Prata", "Bronze"];
const regions = ["Todas", "SP", "RJ", "MG", "RS", "PR", "BA", "SC", "PE"];

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const [tierFilter, setTierFilter] = useState<string>("Todos");
  const [regionFilter, setRegionFilter] = useState("Todas");
  const [search, setSearch] = useState("");

  const players = useMemo(() => {
    return (leaderboard ?? []).map((p) => ({
      id: p.user_id,
      nickname: p.nickname,
      avatar_url: p.avatar_url ?? "",
      elo_points: p.elo_points,
      wins: p.wins,
      losses: p.losses,
      kills: p.kills,
      deaths: p.deaths,
      region: p.region ?? "BR",
      rank: p.rank,
      division: p.division,
    }));
  }, [leaderboard]);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (tierFilter !== "Todos" && p.rank !== tierFilter) return false;
      if (regionFilter !== "Todas" && p.region !== regionFilter) return false;
      if (search && !p.nickname.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, tierFilter, regionFilter, search]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Trophy className="text-primary" size={32} />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">Top jogadores ranqueados da plataforma</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar jogador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary/50"
          >
            {tiers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary/50"
          >
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Player list */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum jogador encontrado.
            </div>
          ) : (
            filtered.map((player, i) => (
              <PlayerRow key={player.id} player={player} position={i + 1} index={i} />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
