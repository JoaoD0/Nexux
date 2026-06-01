import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, Ban, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ReportData {
  id: string;
  reporter_id: string;
  reported_id: string;
  category: string;
  description: string | null;
  status: string;
  match_id: string | null;
  created_at: string;
  reporter_nickname?: string;
  reported_nickname?: string;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pendente",  className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  reviewed:  { label: "Resolvido", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  dismissed: { label: "Ignorado",  className: "bg-muted text-muted-foreground border-border" },
};

const PER_PAGE = 20;

export default function AdminReports() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; report: ReportData } | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("reports")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, count, error } = await query;
      if (error) throw error;

      const rows = data ?? [];

      // Fetch nicknames for reporter and reported
      const userIds = [...new Set(rows.flatMap((r: any) => [r.reporter_id, r.reported_id]))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nickname")
          .in("user_id", userIds);

        const map: Record<string, string> = {};
        (profiles ?? []).forEach((p: any) => { map[p.user_id] = p.nickname; });

        setReports(rows.map((r: any) => ({
          ...r,
          reporter_nickname: map[r.reporter_id] ?? r.reporter_id.slice(0, 8),
          reported_nickname: map[r.reported_id] ?? r.reported_id.slice(0, 8),
        })));
      } else {
        setReports(rows);
      }

      setTotal(count ?? 0);
    } catch (err) {
      toast({ title: "Erro ao carregar denúncias", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setActing(true);
    const { type, report } = confirmAction;
    try {
      if (type === "ban") {
        const { error } = await supabase.rpc("admin_set_ban" as any, {
          p_user_id: report.reported_id,
          p_banned: true,
        });
        if (error) throw error;
      }

      const newStatus = type === "ignore" ? "dismissed" : "reviewed";
      const { error } = await supabase
        .from("reports")
        .update({ status: newStatus })
        .eq("id", report.id);
      if (error) throw error;

      toast({ title: "Ação executada com sucesso" });
      setConfirmAction(null);
      fetchReports();
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Denúncias</h1>
            <p className="text-muted-foreground mt-1">{total} denúncias encontradas</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48 bg-card border-border">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="reviewed">Resolvidas</SelectItem>
            <SelectItem value="dismissed">Ignoradas</SelectItem>
          </SelectContent>
        </Select>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Nenhuma denúncia encontrada.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Reportado por</TableHead>
                    <TableHead>Jogador Reportado</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => {
                    const badge = statusBadge[r.status] ?? statusBadge.pending;
                    return (
                      <TableRow key={r.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{r.reporter_nickname}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.reported_nickname}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{r.description ?? "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge className={badge.className}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="text-green-400 hover:text-green-400"
                                onClick={() => setConfirmAction({ type: "resolve", report: r })} title="Resolver">
                                <CheckCircle size={14} />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmAction({ type: "ban", report: r })} title="Banir jogador">
                                <Ban size={14} />
                              </Button>
                              <Button size="icon" variant="ghost"
                                onClick={() => setConfirmAction({ type: "ignore", report: r })} title="Ignorar">
                                <X size={14} />
                              </Button>
                            </div>
                          )}
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

        <Dialog open={!!confirmAction} onOpenChange={() => !acting && setConfirmAction(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Confirmar Ação</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {confirmAction?.type === "resolve" && "Marcar denúncia como resolvida?"}
                {confirmAction?.type === "ignore" && "Ignorar esta denúncia?"}
                {confirmAction?.type === "ban" && `Banir ${confirmAction?.report.reported_nickname} e resolver a denúncia?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={acting}>
                Cancelar
              </Button>
              <Button
                variant={confirmAction?.type === "ban" ? "destructive" : "default"}
                onClick={handleAction}
                disabled={acting}
              >
                {acting && <Loader2 size={14} className="animate-spin mr-2" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
