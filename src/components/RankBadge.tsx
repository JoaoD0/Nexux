import { RankTier, getRankColor } from "@/lib/mockData";
import { Shield } from "lucide-react";

interface RankBadgeProps {
  rank: RankTier;
  division: 1 | 2 | 3;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-xs gap-1",
  md: "text-sm gap-1.5",
  lg: "text-lg gap-2",
};

const iconSize = { sm: 14, md: 18, lg: 24 };

export function RankBadge({ rank, division, size = "md" }: RankBadgeProps) {
  return (
    <span className={`inline-flex items-center font-display font-bold ${getRankColor(rank)} ${sizeClasses[size]}`}>
      <Shield size={iconSize[size]} />
      {rank} {division}
    </span>
  );
}
