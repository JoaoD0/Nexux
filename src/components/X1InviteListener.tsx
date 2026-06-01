import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, X } from "lucide-react";

interface PendingInvite {
  id: string;
  sender_id: string;
  sender_nickname: string;
  sender_avatar: string;
}

export function X1InviteListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`x1-invites-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "x1_invites",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as any;
          const { data: sender } = await supabase
            .from("profiles")
            .select("nickname, avatar_url")
            .eq("user_id", row.sender_id)
            .maybeSingle();

          setInvite({
            id: row.id,
            sender_id: row.sender_id,
            sender_nickname: sender?.nickname ?? "Jogador",
            sender_avatar: sender?.avatar_url ?? "",
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleAccept = async () => {
    if (!invite) return;
    await supabase
      .from("x1_invites" as any)
      .update({ status: "accepted" })
      .eq("id", invite.id);
    const friendName = encodeURIComponent(invite.sender_nickname);
    setInvite(null);
    navigate(`/queue?mode=x1&invite_id=${invite.id}&friend=${friendName}`);
  };

  const handleDecline = async () => {
    if (!invite) return;
    await supabase
      .from("x1_invites" as any)
      .update({ status: "declined" })
      .eq("id", invite.id);
    setInvite(null);
  };

  if (!invite) return null;

  return (
    <Dialog open={true} onOpenChange={handleDecline}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Swords size={20} className="text-primary" />
            Desafio X1 recebido!
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 py-2">
          <img
            src={invite.sender_avatar}
            alt={invite.sender_nickname}
            className="w-12 h-12 rounded-full bg-secondary border-2 border-primary/30"
          />
          <div>
            <p className="font-display font-bold text-foreground">{invite.sender_nickname}</p>
            <p className="text-muted-foreground text-sm">te desafiou para um X1</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button className="flex-1" onClick={handleAccept}>
            <Swords size={16} className="mr-2" />
            Aceitar
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleDecline}>
            <X size={16} className="mr-2" />
            Recusar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
