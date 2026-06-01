import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down";
  delay?: number;
}

export function StatsCard({ label, value, icon: Icon, trend, delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-card rounded-lg p-5 shadow-card border border-border hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground text-sm">{label}</span>
        <Icon size={18} className="text-primary" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-display font-bold text-foreground">{value}</span>
        {trend && (
          <span className={trend === "up" ? "text-win text-xs" : "text-loss text-xs"}>
            {trend === "up" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </motion.div>
  );
}
