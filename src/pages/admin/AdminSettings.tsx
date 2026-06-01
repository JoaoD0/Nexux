import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { adminAction } from "@/hooks/useAdmin";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminAction("get_settings")
      .then((data) => setSettings(data.settings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAction("update_settings", { settings });
      toast({ title: "Sucesso", description: "Configurações salvas" });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Parâmetros da plataforma</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Sistema de ELO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">ELO inicial de novos jogadores</Label>
              <Input
                type="number"
                value={settings.initial_elo ?? "1000"}
                onChange={(e) => setSettings({ ...settings, initial_elo: e.target.value })}
                className="bg-secondary border-border max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">ELO ganho por vitória (base)</Label>
              <Input
                type="number"
                value={settings.elo_win ?? "25"}
                onChange={(e) => setSettings({ ...settings, elo_win: e.target.value })}
                className="bg-secondary border-border max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">ELO perdido por derrota (base)</Label>
              <Input
                type="number"
                value={settings.elo_loss ?? "25"}
                onChange={(e) => setSettings({ ...settings, elo_loss: e.target.value })}
                className="bg-secondary border-border max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Fila de Matchmaking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Tempo máximo de fila (segundos)</Label>
              <Input
                type="number"
                value={settings.queue_timeout ?? "300"}
                onChange={(e) => setSettings({ ...settings, queue_timeout: e.target.value })}
                className="bg-secondary border-border max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Manutenção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Modo de Manutenção</Label>
                <p className="text-sm text-muted-foreground">Bloqueia a fila de matchmaking</p>
              </div>
              <Switch
                checked={settings.maintenance_mode === "true"}
                onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked ? "true" : "false" })}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground glow-primary">
          {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </AdminLayout>
  );
}
