import { Match } from "@/lib/mockData";
import { motion } from "framer-motion";

interface MatchCardProps {
  match: Match;
  index: number;
}

export function MatchCard({ match, index }: MatchCardProps) {
  const isWin = match.result === "win";
  const date = new Date(match.date).toLocaleDateString("pt-BR");

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`flex items-center gap-4 p-4 rounded-lg border bg-card shadow-card transition-colors hover:border-primary/20 ${
        isWin ? "border-l-4 border-l-win" : "border-l-4 border-l-loss"
      } border-border`}
    >
      <div className={`font-display font-bold text-sm w-12 text-center ${isWin ? "text-win" : "text-loss"}`}>
        {isWin ? "VIT" : "DER"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-foreground">{match.map_name}</span>
          <span className="text-muted-foreground text-sm">{match.score}</span>
        </div>
        <span className="text-muted-foreground text-xs">{date}</span>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <div className="text-foreground font-semibold">
            {match.kills}/{match.deaths}/{match.assists}
          </div>
          <div className="text-muted-foreground text-xs">K/D/A</div>
        </div>
        <div className="text-center">
          <div className="text-foreground font-semibold">
            {(match.kills / Math.max(match.deaths, 1)).toFixed(2)}
          </div>
          <div className="text-muted-foreground text-xs">K/D</div>
        </div>
        <div className={`font-display font-bold ${match.elo_change > 0 ? "text-win" : "text-loss"}`}>
          {match.elo_change > 0 ? "+" : ""}{match.elo_change}
        </div>
      </div>
    </motion.div>
  );
}
