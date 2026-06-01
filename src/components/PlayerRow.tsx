import { Player, getRankColor } from "@/lib/mockData";
import { RankBadge } from "./RankBadge";
import { motion } from "framer-motion";

interface PlayerRowProps {
  player: Player;
  position: number;
  index: number;
}

export function PlayerRow({ player, position, index }: PlayerRowProps) {
  const winrate = ((player.wins / (player.wins + player.losses)) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="flex items-center gap-4 px-4 py-3 rounded-lg bg-card border border-border hover:border-primary/20 transition-colors"
    >
      <span
        className={`font-display font-bold w-8 text-center text-lg ${
          position <= 3 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        #{position}
      </span>

      <img
        src={player.avatar_url}
        alt={player.nickname}
        className="w-10 h-10 rounded-full bg-secondary"
      />

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{player.nickname}</div>
        <div className="text-muted-foreground text-xs">{player.region}</div>
      </div>

      <RankBadge rank={player.rank} division={player.division} size="sm" />

      <div className="hidden sm:block text-center w-20">
        <div className="text-foreground text-sm font-semibold">{winrate}%</div>
        <div className="text-muted-foreground text-xs">WR</div>
      </div>

      <div className="text-right w-20">
        <div className="font-display font-bold text-foreground">{player.elo_points}</div>
        <div className="text-muted-foreground text-xs">ELO</div>
      </div>
    </motion.div>
  );
}
