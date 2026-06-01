import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useState, useCallback } from "react";
import { adminAction } from "@/hooks/useAdmin";
import { Search, Ban, ShieldCheck, RotateCcw, Eye, Loader2, ChevronLeft, ChevronRight, ShieldOff } from "lucide-react";
import { getRankFromElo } from "@/lib/mockData";
import { toast } from "@/hooks/use-toast";

interface PlayerData {
  user_id: string;
  nickname: string;
  email: string;
  avatar_url: string;
  elo_points: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  banned: boolean;
  region: string;
  riot_puuid: string | null;
}

export default function AdminPlayers() {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; player: PlayerData } | null>(null);
  const perPage = 20;

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAction("list_players", { search: search || undefined, page, per_page: perPage });
      setPlayers(data.players);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const handleAction = async () => {
    if (!confirmAction) return;
    const { action, player } = confirmAction;
    try {
      await adminAction(action, { user_id: player.user_id });
      toast({ title: "Sucesso", description: `Ação "${action}" executada para ${player.nickname}` });
      setConfirmAction(null);
      setSelectedPlayer(null);
      fetchPlayers();
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Jogadores</h1>
          <p className="text-muted-foreground mt-1">{total} jogadores cadastrados</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nick..."
              className="pl-10 bg-card border-border"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Jogador</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>ELO</TableHead>
                    <TableHead>W/L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((p) => {
                    const rank = getRankFromElo(p.elo_points);
                    return (
                      <TableRow key={p.user_id} className="border-border">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full bg-secondary" />
                            <span className="font-medium text-foreground">{p.nickname}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.email}</TableCell>
                        <TableCell>
                          <span className="font-display text-sm">{rank.rank} {rank.division}</span>
                        </TableCell>
                        <TableCell className="font-display font-bold">{p.elo_points}</TableCell>
                        <TableCell>
                          <span className="text-win">{p.wins}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-loss">{p.losses}</span>
                        </TableCell>
                        <TableCell>
                          {p.banned ? (
                            <Badge variant="destructive">Banido</Badge>
                          ) : (
                            <Badge className="bg-win/20 text-win border-win/30">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setSelectedPlayer(p)} title="Ver perfil">
                              <Eye size={14} />
                            </Button>
                            {p.banned ? (
                              <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ action: "unban_player", player: p })} title="Remover ban">
                                <ShieldOff size={14} />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmAction({ action: "ban_player", player: p })} title="Banir">
                                <Ban size={14} />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ action: "promote_admin", player: p })} title="Promover admin">
                              <ShieldCheck size={14} />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ action: "reset_elo", player: p })} title="Resetar ELO">
                              <RotateCcw size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* Player Detail Modal */}
        <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Perfil do Jogador</DialogTitle>
              <DialogDescription className="text-muted-foreground">Detalhes completos do jogador</DialogDescription>
            </DialogHeader>
            {selectedPlayer && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img src={selectedPlayer.avatar_url} alt="" className="w-16 h-16 rounded-full bg-secondary" />
                  <div>
                    <div className="font-display font-bold text-xl text-foreground">{selectedPlayer.nickname}</div>
                    <div className="text-sm text-muted-foreground">{selectedPlayer.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-muted-foreground text-sm">ELO:</span> <span className="font-bold">{selectedPlayer.elo_points}</span></div>
                  <div><span className="text-muted-foreground text-sm">Região:</span> <span className="font-bold">{selectedPlayer.region}</span></div>
                  <div><span className="text-muted-foreground text-sm">Vitórias:</span> <span className="font-bold text-win">{selectedPlayer.wins}</span></div>
                  <div><span className="text-muted-foreground text-sm">Derrotas:</span> <span className="font-bold text-loss">{selectedPlayer.losses}</span></div>
                  <div><span className="text-muted-foreground text-sm">Kills:</span> <span className="font-bold">{selectedPlayer.kills}</span></div>
                  <div><span className="text-muted-foreground text-sm">Deaths:</span> <span className="font-bold">{selectedPlayer.deaths}</span></div>
                  <div><span className="text-muted-foreground text-sm">Riot PUUID:</span> <span className="font-bold text-xs">{selectedPlayer.riot_puuid || "Não definido"}</span></div>
                  <div><span className="text-muted-foreground text-sm">Status:</span> {selectedPlayer.banned ? <Badge variant="destructive">Banido</Badge> : <Badge className="bg-win/20 text-win border-win/30">Ativo</Badge>}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Action Modal */}
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Confirmar Ação</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {confirmAction?.action === "ban_player" && `Banir jogador ${confirmAction?.player.nickname}?`}
                {confirmAction?.action === "unban_player" && `Remover ban de ${confirmAction?.player.nickname}?`}
                {confirmAction?.action === "promote_admin" && `Promover ${confirmAction?.player.nickname} a admin?`}
                {confirmAction?.action === "reset_elo" && `Resetar ELO de ${confirmAction?.player.nickname} para 1000?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
              <Button variant={confirmAction?.action === "ban_player" ? "destructive" : "default"} onClick={handleAction}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
