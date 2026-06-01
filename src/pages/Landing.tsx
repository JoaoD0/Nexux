import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, Target, Trophy, Users, ChevronRight, Shield, Zap } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: Target,
    title: "Matchmaking Competitivo",
    desc: "Encontre partidas equilibradas baseadas no seu ELO e performance.",
  },
  {
    icon: Trophy,
    title: "Sistema de Ranking",
    desc: "Evolua do Bronze ao Imortal com nosso sistema de tiers e divisões.",
  },
  {
    icon: Users,
    title: "Comunidade BR",
    desc: "Feita para jogadores brasileiros, com servidores de baixa latência.",
  },
  {
    icon: Shield,
    title: "Anti-Toxicidade",
    desc: "Sistema de reports e punições para um ambiente competitivo saudável.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-background/70" />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <Swords className="text-primary" size={48} />
              <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground">
                RANKED<span className="text-primary">BR</span>
              </h1>
            </div>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 font-light">
              A plataforma de matchmaking competitivo de Valorant para o Brasil.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-gradient-primary text-primary-foreground font-display font-bold text-lg glow-primary hover:glow-primary-strong transition-shadow"
              >
                <Zap size={20} />
                COMEÇAR AGORA
                <ChevronRight size={18} />
              </Link>
              <Link
                to="/leaderboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-border text-foreground font-display font-bold text-lg hover:bg-secondary transition-colors"
              >
                VER RANKING
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-center text-foreground mb-16"
          >
            POR QUE JOGAR NO <span className="text-gradient">RANKEDBR</span>?
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors shadow-card"
              >
                <feat.icon className="text-primary mb-4" size={32} />
                <h3 className="font-display font-bold text-xl text-foreground mb-2">{feat.title}</h3>
                <p className="text-muted-foreground">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-border">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">
            PRONTO PARA COMPETIR?
          </h2>
          <p className="text-muted-foreground mb-8">
            Junte-se a milhares de jogadores brasileiros e prove seu valor no competitivo.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-primary text-primary-foreground font-display font-bold text-lg glow-primary hover:glow-primary-strong transition-shadow"
          >
            CRIAR CONTA GRÁTIS
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-muted-foreground text-sm">
          <div className="flex items-center gap-2 font-display font-bold text-foreground">
            <Swords className="text-primary" size={20} />
            RANKED<span className="text-primary">BR</span>
          </div>
          <p>© 2025 RankedBR. Não afiliado à Riot Games.</p>
        </div>
      </footer>
    </div>
  );
}
