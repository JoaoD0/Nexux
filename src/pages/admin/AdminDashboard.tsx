import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Swords, Activity, Wifi, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Stats {
  totalPlayers: number;
  inQueue: number;
  lobby: number;
  banning: number;
  inProgress: number;
  finished: number;
  cancelled: number;
  today: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: totalPlayers },
      { count: inQueue },
      { count: lobby },
      { count: banning },
      { count: inProgress },
      { count: finished },
      { count: cancelled },
      { count: todayMatches },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("queue").select("*", { count: "exact", head: true }).eq("status", "searching"),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "lobby"),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "banning"),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "finished"),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
      supabase.from("matches").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    ]);

    setStats({
      totalPlayers: totalPlayers ?? 0,
      inQueue: inQueue ?? 0,
      lobby: lobby ?? 0,
      banning: banning ?? 0,
      inProgress: inProgress ?? 0,
      finished: finished ?? 0,
      cancelled: cancelled ?? 0,
      today: todayMatches ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading || !stats) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </AdminLayout>
    );
  }

  const activeTotal = stats.lobby + stats.banning + stats.inProgress;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral da plataforma</p>
          </div>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors"
          >
            Atualizar
          </button>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Jogadores</CardTitle>
              <Users size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">{stats.totalPlayers}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Na Fila Agora</CardTitle>
              <Wifi size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">{stats.inQueue}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Partidas Ativas</CardTitle>
              <Activity size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">{activeTotal}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Partidas Hoje</CardTitle>
              <Swords size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">{stats.today}</div>
            </CardContent>
          </Card>
        </div>

        {/* Status detalhado */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-display text-foreground">Partidas Ativas por Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-yellow-400" />
                  <span className="text-muted-foreground">Lobby</span>
                </div>
                <span className="font-display font-bold text-yellow-400 text-xl">{stats.lobby}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Swords size={16} className="text-orange-400" />
                  <span className="text-muted-foreground">Ban de Mapas</span>
                </div>
                <span className="font-display font-bold text-orange-400 text-xl">{stats.banning}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-blue-400" />
                  <span className="text-muted-foreground">Em Andamento</span>
                </div>
                <span className="font-display font-bold text-blue-400 text-xl">{stats.inProgress}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-display text-foreground">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-muted-foreground">Concluídas</span>
                </div>
                <span className="font-display font-bold text-green-400 text-xl">{stats.finished}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <XCircle size={16} className="text-destructive" />
                  <span className="text-muted-foreground">Canceladas</span>
                </div>
                <span className="font-display font-bold text-destructive text-xl">{stats.cancelled}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Total geral</span>
                <span className="font-display font-bold text-foreground text-xl">
                  {stats.finished + stats.cancelled + activeTotal}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
