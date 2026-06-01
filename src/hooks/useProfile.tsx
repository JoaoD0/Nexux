import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { getRankFromElo } from "@/lib/mockData";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles"> & {
  rank: ReturnType<typeof getRankFromElo>["rank"];
  division: ReturnType<typeof getRankFromElo>["division"];
};

function enrichProfile(p: Tables<"profiles">): Profile {
  const { rank, division } = getRankFromElo(p.elo_points);
  return { ...p, rank, division };
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? enrichProfile(data) : null;
    },
    enabled: !!user,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("elo_points", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(enrichProfile);
    },
  });
}

export function useMatchHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["match-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("match_players")
        .select("*, matches(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Tables<"profiles">>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}
