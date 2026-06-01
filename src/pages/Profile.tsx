import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { RankBadge } from "@/components/RankBadge";
import { MatchCard } from "@/components/MatchCard";
import { useProfile, useMatchHistory, useUpdateProfile } from "@/hooks/useProfile";
import { motion } from "framer-motion";
import { Trophy, Target, Percent, TrendingUp, MapPin, Calendar, Swords, Loader2, Save, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { data: profile, isLoading } = useProfile();
  const { data: matchHistory } = useMatchHistory();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const [riotPuuid, setRiotPuuid] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.riot_puuid) setRiotPuuid(profile.riot_puuid);
  }, [profile?.riot_puuid]);

  if (isLoading || !profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  const winrate = profile.wins + profile.losses > 0
    ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1)
    : "0.0";
  const kd = (profile.kills / Math.max(profile.deaths, 1)).toFixed(2);
  const totalGames = profile.wins + profile.losses;

  const recentMatches = (matchHistory ?? []).slice(0, 10).map((mp: any) => ({
    id: mp.id,
    map_name: mp.matches?.map_name ?? "Unknown",
    date: mp.created_at,
    result: (mp.result ?? "loss") as "win" | "loss",
    kills: mp.kills ?? 0,
    deaths: mp.deaths ?? 0,
    assists: mp.assists ?? 0,
    elo_change: (mp.elo_after ?? mp.elo_before) - mp.elo_before,
    score: "",
  }));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-8 shadow-card"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <img
              src={profile.avatar_url ?? ""}
              alt={profile.nickname}
              className="w-24 h-24 rounded-full bg-secondary border-4 border-primary/30"
            />
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-display font-bold text-foreground mb-1">
                {profile.nickname}
              </h1>
              <RankBadge rank={profile.rank} division={profile.division} size="lg" />
              <div className="flex flex-wrap gap-4 mt-4 justify-center sm:justify-start text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin size={14} /> {profile.region ?? "BR"}
                </span>
                <span className="flex items-center gap-1">
                  <Swords size={14} /> {totalGames} partidas
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> Membro desde {new Date(profile.created_at).getFullYear()}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-5xl font-bold text-foreground">{profile.elo_points}</div>
              <div className="text-muted-foreground text-sm">ELO</div>
            </div>
          </div>
        </motion.div>

        {/* Riot PUUID */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-6 shadow-card"
        >
          <h3 className="font-display font-bold text-foreground mb-3">Riot PUUID (Valorant)</h3>
          <p className="text-muted-foreground text-sm mb-3">
            Cole seu Riot PUUID para vincular sua conta. Obtenha em{" "}
            <a href="https://valorant-api.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
              valorant-api.com <ExternalLink size={12} />
            </a>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={riotPuuid}
              onChange={(e) => setRiotPuuid(e.target.value.trim())}
              placeholder="Ex: a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              maxLength={128}
              className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              disabled={saving || riotPuuid === (profile?.riot_puuid ?? "")}
              onClick={async () => {
                if (!riotPuuid) return;
                setSaving(true);
                try {
                  await updateProfile.mutateAsync({ riot_puuid: riotPuuid } as any);
                  toast({ title: "PUUID salvo!", description: "Seu Riot PUUID foi vinculado ao perfil." });
                } catch {
                  toast({ title: "Erro ao salvar", variant: "destructive" });
                } finally {
                  setSaving(false);
                }
              }}
              className="px-4 py-2 bg-gradient-primary text-primary-foreground rounded-lg font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            >
              <Save size={14} /> Salvar
            </button>
          </div>
          {profile?.riot_puuid && (
            <div className="mt-2 text-xs text-muted-foreground">
              PUUID atual: <code className="bg-secondary px-1 rounded">{profile.riot_puuid}</code>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label="Vitórias" value={profile.wins} icon={Trophy} delay={0} />
          <StatsCard label="Derrotas" value={profile.losses} icon={Target} delay={0.1} />
          <StatsCard label="K/D" value={kd} icon={TrendingUp} delay={0.2} />
          <StatsCard label="Winrate" value={`${winrate}%`} icon={Percent} delay={0.3} />
        </div>

        {/* Win/Loss bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-lg p-6 shadow-card"
        >
          <h3 className="font-display font-bold text-foreground mb-4">Distribuição de Resultados</h3>
          <div className="flex rounded-full overflow-hidden h-4">
            <div className="bg-win transition-all" style={{ width: `${winrate}%` }} />
            <div className="bg-loss flex-1" />
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-win">{profile.wins}V ({winrate}%)</span>
            <span className="text-loss">{profile.losses}D ({(100 - parseFloat(winrate)).toFixed(1)}%)</span>
          </div>
        </motion.div>

        {/* Recent matches */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-xl text-foreground">Últimas Partidas</h2>
          {recentMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-lg">
              Nenhuma partida jogada ainda.
            </div>
          ) : (
            recentMatches.map((match, i) => (
              <MatchCard key={match.id} match={match} index={i} />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
