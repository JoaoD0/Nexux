import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Swords, Shuffle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function X1InviteModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [nickname, setNickname] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<{ user_id: string; nickname: string; avatar_url: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSearch = async () => {
    if (!nickname.trim()) return;
    setSearching(true);
    setFound(null);
    setNotFound(false);

    const { data } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url")
      .ilike("nickname", nickname.trim())
      .neq("user_id", user?.id ?? "")
      .limit(1)
      .maybeSingle();

    setFound(data ?? null);
    setNotFound(!data);
    setSearching(false);
  };

  const handleInvite = async () => {
    if (!found || !user) return;
    setSending(true);

    const { data: invite, error } = await supabase
      .from("x1_invites" as any)
      .insert({ sender_id: user.id, receiver_id: found.user_id })
      .select("id")
      .single();

    if (error || !invite) {
      toast({ title: "Erro", description: "Falha ao enviar convite.", variant: "destructive" });
      setSending(false);
      return;
    }

    toast({ title: "Convite enviado!", description: `Aguardando ${found.nickname} aceitar...` });
    onClose();
    navigate(`/queue?mode=x1&invite_id=${(invite as any).id}&friend=${encodeURIComponent(found.nickname)}`);
  };

  const handleRandom = () => {
    onClose();
    navigate("/queue?mode=x1");
  };

  const handleClose = () => {
    setNickname("");
    setFound(null);
    setNotFound(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Swords size={20} className="text-primary" />
            Modo X1
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <button
            onClick={handleRandom}
            className="w-full px-4 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center gap-3 text-left"
          >
            <Shuffle size={18} className="text-muted-foreground" />
            <div>
              <p className="font-display font-bold text-foreground text-sm">Aleatório</p>
              <p className="text-muted-foreground text-xs">Entra na fila com qualquer jogador</p>
            </div>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">ou desafie um amigo</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Nickname do amigo..."
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNotFound(false);
                setFound(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="font-display"
            />
            <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </Button>
          </div>

          {found && (
            <div className="flex items-center gap-3 p-3 bg-card border border-primary/30 rounded-lg">
              <img
                src={found.avatar_url}
                alt={found.nickname}
                className="w-10 h-10 rounded-full bg-secondary"
              />
              <span className="font-display font-bold text-foreground flex-1">{found.nickname}</span>
              <Button size="sm" onClick={handleInvite} disabled={sending}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : "Desafiar"}
              </Button>
            </div>
          )}

          {notFound && (
            <p className="text-sm text-muted-foreground text-center">Nenhum jogador encontrado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
