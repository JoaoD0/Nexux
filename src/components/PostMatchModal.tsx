import { Player } from "@/lib/mockData";
import { getTeamAvgElo } from "@/lib/matchmaking";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Skull, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface PostMatchModalProps {
  open: boolean;
  onClose: () => void;
  team1: Player[];
  team2: Player[];
  matchId: string;
}

type MatchResult = "win" | "loss" | "draw" | null;

export function PostMatchModal({ open, onClose, team1, team2, matchId }: PostMatchModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<MatchResult>(null);
  const [kills, setKills] = useState("");
  const [deaths, setDeaths] = useState("");
  const [assists, setAssists] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [eloChangeResult, setEloChangeResult] = useState(0);

  const myTeam = team1.find((p) => p.id === user?.id) ? team1 : team2;
  const oppTeam = myTeam === team1 ? team2 : team1;
  const myAvg = getTeamAvgElo(myTeam);
  const oppAvg = getTeamAvgElo(oppTeam);

  const handleSubmit = async () => {
    if (!result || !user || !profile) return;
    if (result !== "draw" && (!kills || !deaths)) {
      toast({ title: "Preencha K/D/A", variant: "destructive" });
      return;
    }

    // Use server-side RPC to submit match result securely
    const { data, error } = await supabase.rpc("submit_match_result", {
      p_match_id: matchId,
      p_result: result,
      p_kills: parseInt(kills) || 0,
      p_deaths: parseInt(deaths) || 0,
      p_assists: parseInt(assists) || 0,
    });

    if (error) {
      toast({ title: "Erro ao registrar resultado", description: error.message, variant: "destructive" });
      return;
    }

    const eloChange = (data as any)?.elo_change ?? 0;
    setEloChangeResult(eloChange);
    setSubmitted(true);

    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["match-history"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast({
        title: result === "win" ? "Vitória registrada!" : result === "loss" ? "Derrota registrada." : "Empate registrado.",
        description: `ELO: ${eloChange >= 0 ? "+" : ""}${eloChange} pontos`,
      });
      onClose();
      navigate("/dashboard");
    }, 2000);
  };

  if (submitted) {
    const eloChange = eloChangeResult;
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-card border-border [&>button]:hidden">
          <div className="text-center py-8 space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className={`text-6xl ${result === "win" ? "text-win" : result === "loss" ? "text-loss" : "text-muted-foreground"}`}
            >
              {result === "win" ? <Trophy size={64} className="mx-auto" /> : result === "loss" ? <Skull size={64} className="mx-auto" /> : <Minus size={64} className="mx-auto" />}
            </motion.div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {result === "win" ? "VITÓRIA!" : result === "loss" ? "DERROTA" : "EMPATE"}
            </h2>
            <div className={`font-display text-3xl font-bold flex items-center justify-center gap-2 ${eloChange >= 0 ? "text-win" : "text-loss"}`}>
              {eloChange >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              {eloChange >= 0 ? "+" : ""}{eloChange} ELO
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-center">Como foi sua partida?</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          {(["win", "loss", "draw"] as const).map((r) => (
            <button key={r} onClick={() => setResult(r)}
              className={`p-4 rounded-lg border-2 font-display font-bold text-sm transition-all flex flex-col items-center gap-2 ${
                result === r
                  ? r === "win" ? "border-win bg-win/10 text-win"
                    : r === "loss" ? "border-loss bg-loss/10 text-loss"
                    : "border-muted-foreground bg-muted text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              {r === "win" ? <Trophy size={24} /> : r === "loss" ? <Skull size={24} /> : <Minus size={24} />}
              {r === "win" ? "VITÓRIA" : r === "loss" ? "DERROTA" : "EMPATE"}
            </button>
          ))}
        </div>

        {result && result !== "draw" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-3 gap-3">
            {[{ label: "Kills", val: kills, set: setKills }, { label: "Deaths", val: deaths, set: setDeaths }, { label: "Assists", val: assists, set: setAssists }].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-muted-foreground text-xs block mb-1">{label}</label>
                <input type="number" min="0" value={val} onChange={(e) => set(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground text-center font-display font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
              </div>
            ))}
          </motion.div>
        )}

        <button onClick={handleSubmit} disabled={!result}
          className="w-full py-3 bg-gradient-primary text-primary-foreground rounded-lg font-display font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          REGISTRAR RESULTADO
        </button>
      </DialogContent>
    </Dialog>
  );
}
