import { Player } from "@/lib/mockData";
import { RankBadge } from "./RankBadge";
import { getTeamAvgElo, getBalanceLabel } from "@/lib/matchmaking";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Users, Scale } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MatchFoundModalProps {
  open: boolean;
  matchData: { team1: Player[]; team2: Player[]; diff: number } | null;
  onAccept: () => void;
  onDecline: () => void;
}

export function MatchFoundModal({ open, matchData, onAccept, onDecline }: MatchFoundModalProps) {
  const [countdown, setCountdown] = useState(30);
  const [accepted, setAccepted] = useState(0);

  useEffect(() => {
    if (!open) return;
    setCountdown(30);
    setAccepted(0);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Simulate other players accepting
    const acceptTimer = setInterval(() => {
      setAccepted((prev) => Math.min(prev + 1, 9));
    }, 2000 + Math.random() * 1500);

    return () => {
      clearInterval(timer);
      clearInterval(acceptTimer);
    };
  }, [open]);

  if (!matchData) return null;

  const balance = getBalanceLabel(matchData.diff);
  const avg1 = getTeamAvgElo(matchData.team1);
  const avg2 = getTeamAvgElo(matchData.team2);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl bg-card border-primary/30 glow-primary [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-2"
            >
              <div className="text-3xl font-display font-bold text-primary animate-pulse-glow inline-block px-4 py-1">
                ⚔️ PARTIDA ENCONTRADA ⚔️
              </div>
              <div className="text-muted-foreground text-sm font-normal">
                Aceite em {countdown} segundos
              </div>
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        {/* Countdown bar */}
        <div className="bg-secondary rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-primary"
            initial={{ width: "100%" }}
            animate={{ width: `${(countdown / 30) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        {/* Accepted counter */}
        <div className="text-center text-sm text-muted-foreground">
          <Users size={14} className="inline mr-1" />
          <span className="text-foreground font-bold">{accepted + 1}/10</span> aceitaram
        </div>

        {/* Teams Preview */}
        <div className="grid grid-cols-2 gap-4">
          {/* Team 1 */}
          <div className="space-y-2">
            <div className="text-center font-display font-bold text-foreground text-sm">
              TIME 1 <span className="text-muted-foreground font-normal">({avg1} ELO)</span>
            </div>
            {matchData.team1.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-secondary/50 rounded-md p-2 flex items-center gap-2"
              >
                <img src={p.avatar_url} alt={p.nickname} className="w-8 h-8 rounded-full bg-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xs font-bold text-foreground truncate">
                    {p.nickname}
                    {p.id === "current" && <span className="text-primary ml-1">(Você)</span>}
                  </div>
                  <RankBadge rank={p.rank} division={p.division} size="sm" />
                </div>
                <span className="text-muted-foreground text-xs">{p.elo_points}</span>
              </motion.div>
            ))}
          </div>

          {/* Team 2 */}
          <div className="space-y-2">
            <div className="text-center font-display font-bold text-foreground text-sm">
              TIME 2 <span className="text-muted-foreground font-normal">({avg2} ELO)</span>
            </div>
            {matchData.team2.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-secondary/50 rounded-md p-2 flex items-center gap-2"
              >
                <img src={p.avatar_url} alt={p.nickname} className="w-8 h-8 rounded-full bg-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xs font-bold text-foreground truncate">
                    {p.nickname}
                  </div>
                  <RankBadge rank={p.rank} division={p.division} size="sm" />
                </div>
                <span className="text-muted-foreground text-xs">{p.elo_points}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Balance indicator */}
        <div className="text-center flex items-center justify-center gap-2">
          <Scale size={16} className={balance.color} />
          <span className={`font-display font-bold ${balance.color}`}>
            Balanceamento: {balance.label}
          </span>
          <span className="text-muted-foreground text-xs">(±{matchData.diff} ELO)</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 justify-center mt-2">
          <button
            onClick={onAccept}
            className="flex-1 max-w-[200px] px-6 py-4 bg-win/20 border-2 border-win text-win rounded-lg font-display font-bold text-lg hover:bg-win/30 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 size={22} />
              ACEITAR
            </span>
          </button>
          <button
            onClick={onDecline}
            className="flex-1 max-w-[200px] px-6 py-4 bg-destructive/10 border-2 border-destructive text-destructive rounded-lg font-display font-bold text-lg hover:bg-destructive/20 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <XCircle size={22} />
              RECUSAR
            </span>
          </button>
        </div>

        <p className="text-center text-muted-foreground text-xs">
          Recusar ou não aceitar a tempo: -10 ELO + 5min cooldown
        </p>
      </DialogContent>
    </Dialog>
  );
}
