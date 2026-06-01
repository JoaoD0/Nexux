import { Player } from "@/lib/mockData";
import { RankBadge } from "./RankBadge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface ReportPlayerModalProps {
  open: boolean;
  player: Player | null;
  onClose: () => void;
  matchId?: string;
}

const CATEGORIES = [
  "Comportamento tóxico",
  "Trapaça / Cheating",
  "Trolling / Sabotagem",
  "AFK / Abandono",
  "Outro",
];

export function ReportPlayerModal({ open, player, onClose, matchId }: ReportPlayerModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  if (!player) return null;

  const handleSubmit = async () => {
    if (!category) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    if (!user) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_id: player.id,
      match_id: matchId || null,
      category,
      description: description || null,
    });

    if (error) {
      toast({ title: "Erro ao enviar report", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Report enviado!", description: `${player.nickname} foi reportado por "${category}".` });
    setCategory("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Flag size={20} className="text-destructive" />
            Reportar Jogador
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
          <img src={player.avatar_url} alt={player.nickname} className="w-10 h-10 rounded-full bg-secondary" />
          <div>
            <div className="font-display font-bold text-foreground">{player.nickname}</div>
            <RankBadge rank={player.rank} division={player.division} size="sm" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-muted-foreground text-sm">Categoria</label>
          <div className="grid grid-cols-1 gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                  category === cat
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {category === "Outro" && (
          <div>
            <label className="text-muted-foreground text-sm block mb-1">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              maxLength={300} rows={3}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="Descreva o problema..."
            />
          </div>
        )}

        <button onClick={handleSubmit}
          className="w-full py-3 bg-destructive text-destructive-foreground rounded-lg font-display font-bold hover:bg-destructive/90 transition-colors"
        >
          ENVIAR REPORT
        </button>
      </DialogContent>
    </Dialog>
  );
}
