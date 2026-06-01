import { Layout } from "@/components/Layout";
import { MatchCard } from "@/components/MatchCard";
import { useMatchHistory } from "@/hooks/useProfile";
import { History, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";

const filters = ["Todas", "Vitórias", "Derrotas"];

export default function MatchHistory() {
  const { data: matchHistory, isLoading } = useMatchHistory();
  const [filter, setFilter] = useState("Todas");

  const matches = useMemo(() => {
    return (matchHistory ?? []).map((mp: any) => ({
      id: mp.id,
      map_name: mp.matches?.map_name ?? "Unknown",
      date: mp.created_at,
      result: (mp.result ?? "loss") as "win" | "loss",
      kills: mp.kills ?? 0,
      deaths: mp.deaths ?? 0,
      assists: mp.assists ?? 0,
      elo_change: (mp.elo_after ?? mp.elo_before) - mp.elo_before,
      score: "",
    }));
  }, [matchHistory]);

  const filtered = matches.filter((m) => {
    if (filter === "Vitórias") return m.result === "win";
    if (filter === "Derrotas") return m.result === "loss";
    return true;
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <History className="text-primary" size={32} />
            Histórico de Partidas
          </h1>
        </motion.div>

        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma partida encontrada.
            </div>
          ) : (
            filtered.map((match, i) => (
              <MatchCard key={match.id} match={match} index={i} />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
