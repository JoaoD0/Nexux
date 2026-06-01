import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, XCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MatchPlayer {
  user_id: string;
  team: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  result: string | null;
  elo_before: number;
  elo_after: number | null;
}

interface MatchData {
  id: string;
  mode: string;
  map_name: string;
  status: string;
  created_at: string;
  team1_avg_elo: number;
  team2_avg_elo: number;
  match_players: MatchPlayer[];
}

interface PlayerProfile {
  user_id: string;
  nickname: string;
  avatar_url: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  lobby:       { label: "Lobby",        className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  banning:     { label: "Ban de Mapas", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  in_progress: { label: "Em andamento", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished:    { label: "Concluída",    className: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelled:   { label: "Cancelada",    className: "bg-destructive/20 text-destructive border-destructive/30" },
};

const PER_PAGE = 20;

export default function AdminMatches() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [confirmCancel, setConfirmCancel] = useState<MatchData | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("matches")
        .select("id, mode, map_name, status, created_at, team1_avg_elo, team2_avg_elo, match_players(user_id, team, kills, deaths, assists, result, elo_before, elo_after)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

      if (statusFilter === "active") {
        query = query.in("status", ["lobby", "banning", "in_progress"]);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setMatches((data as any) ?? []);
      setTotal(count ?? 0);

      // Fetch profiles for all players
      const userIds = [...new Set((data ?? []).flatMap((m: any) => m.match_players.map((p: any) => p.user_id)))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, nickname, avatar_url")
          .in("user_id", userIds);
        const map: Record<string, PlayerProfile> = {};
        (profileData ?? []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao carregar partidas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      const { error } = await supabase.rpc("admin_cancel_match" as any, { p_match_id: confirmCancel.id });
      if (error) throw error;
      toast({ title: "Partida cancelada com sucesso" });
      setConfirmCancel(null);
      setSelectedMatch(null);
      fetchMatches();
    } catch (err) {
      toast({ title: "Erro ao cancelar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);
  const isActive = (status: string) => ["lobby", "banning", "in_progress"].includes(status);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Partidas</h1>
            <p className="text-muted-foreground mt-1">{total} partidas encontradas</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMatches} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-52 bg-card border-border">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativas (lobby + ban + jogo)</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="lobby">Lobby</SelectItem>
            <SelectItem value="banning">Ban de Mapas</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="finished">Concluídas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Nenhuma partida encontrada.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>ID</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Mapa</TableHead>
                    <TableHead>ELO médio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m) => {
                    const cfg = statusConfig[m.status] ?? statusConfig.lobby;
                    return (
                      <TableRow key={m.id} className="border-border">
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-display text-xs">{m.mode.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="font-display font-bold">{m.map_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.team1_avg_elo} vs {m.team2_avg_elo}</TableCell>
                        <TableCell>
                          <Badge className={cfg.className}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setSelectedMatch(m)} title="Detalhes">
                              <Eye size={14} />
                            </Button>
                            {isActive(m.status) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmCancel(m)}
                                title="Fechar lobby"
                              >
                                <XCircle size={14} />
                              </Button>
                            )}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* Detalhes da partida */}
        <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">
                Detalhes — {selectedMatch?.mode.toUpperCase()} — {selectedMatch?.map_name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-mono text-xs">
                {selectedMatch?.id}
              </DialogDescription>
            </DialogHeader>
            {selectedMatch && (
              <div className="space-y-4">
                <div className="flex gap-2 items-center">
                  <Badge className={statusConfig[selectedMatch.status]?.className}>
                    {statusConfig[selectedMatch.status]?.label}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {new Date(selectedMatch.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {[1, 2].map((team) => {
                  const players = selectedMatch.match_players.filter((p) => p.team === team);
                  return (
                    <div key={team}>
                      <h3 className="font-display font-bold text-sm text-muted-foreground mb-2">
                        Time {team} — ELO médio: {team === 1 ? selectedMatch.team1_avg_elo : selectedMatch.team2_avg_elo}
                      </h3>
                      <div className="space-y-1">
                        {players.map((p) => {
                          const profile = profiles[p.user_id];
                          return (
                            <div key={p.user_id} className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2">
                              {profile?.avatar_url && (
                                <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full bg-secondary" />
                              )}
                              <span className="font-medium text-sm text-foreground flex-1">
                                {profile?.nickname ?? p.user_id.slice(0, 8)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {p.kills ?? "-"}/{p.deaths ?? "-"}/{p.assists ?? "-"}
                              </span>
                              {p.result && (
                                <Badge className={p.result === "win" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-destructive/20 text-destructive border-destructive/30"}>
                                  {p.result}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {isActive(selectedMatch.status) && (
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => { setConfirmCancel(selectedMatch); setSelectedMatch(null); }}
                    >
                      <XCircle size={16} className="mr-2" />
                      Fechar este lobby
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirmar cancelamento */}
        <Dialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Fechar lobby?</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                A partida <span className="font-mono text-xs">{confirmCancel?.id.slice(0, 8)}</span> será cancelada.
                Nenhum ELO será alterado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmCancel(null)} disabled={cancelling}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling && <Loader2 size={14} className="animate-spin mr-2" />}
                Confirmar cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
