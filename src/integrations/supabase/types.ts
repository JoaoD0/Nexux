export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          match_id: string
          message: string
          nickname: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          match_id: string
          message: string
          nickname: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          match_id?: string
          message?: string
          nickname?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      map_bans: {
        Row: {
          ban_order: number
          created_at: string
          id: string
          map_name: string
          match_id: string
          player_id: string
        }
        Insert: {
          ban_order: number
          created_at?: string
          id?: string
          map_name: string
          match_id: string
          player_id: string
        }
        Update: {
          ban_order?: number
          created_at?: string
          id?: string
          map_name?: string
          match_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_bans_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          assists: number | null
          created_at: string
          deaths: number | null
          elo_after: number | null
          elo_before: number
          id: string
          kills: number | null
          match_id: string
          result: string | null
          team: number
          user_id: string
        }
        Insert: {
          assists?: number | null
          created_at?: string
          deaths?: number | null
          elo_after?: number | null
          elo_before: number
          id?: string
          kills?: number | null
          match_id: string
          result?: string | null
          team: number
          user_id: string
        }
        Update: {
          assists?: number | null
          created_at?: string
          deaths?: number | null
          elo_after?: number | null
          elo_before?: number
          id?: string
          kills?: number | null
          match_id?: string
          result?: string | null
          team?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          banned_maps: string[] | null
          created_at: string
          final_map: string | null
          finished_at: string | null
          id: string
          map_name: string
          mode: string
          server_ip: string
          server_password: string
          source: string
          status: string
          team1_avg_elo: number
          team2_avg_elo: number
        }
        Insert: {
          banned_maps?: string[] | null
          created_at?: string
          final_map?: string | null
          finished_at?: string | null
          id?: string
          map_name: string
          mode?: string
          server_ip: string
          server_password: string
          source?: string
          status?: string
          team1_avg_elo?: number
          team2_avg_elo?: number
        }
        Update: {
          banned_maps?: string[] | null
          created_at?: string
          final_map?: string | null
          finished_at?: string | null
          id?: string
          map_name?: string
          mode?: string
          server_ip?: string
          server_password?: string
          source?: string
          status?: string
          team1_avg_elo?: number
          team2_avg_elo?: number
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          created_at: string
          deaths: number
          elo_points: number
          elo_x1: number
          id: string
          kills: number
          losses: number
          nickname: string
          region: string | null
          riot_puuid: string | null
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          deaths?: number
          elo_points?: number
          elo_x1?: number
          id?: string
          kills?: number
          losses?: number
          nickname: string
          region?: string | null
          riot_puuid?: string | null
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          deaths?: number
          elo_points?: number
          elo_x1?: number
          id?: string
          kills?: number
          losses?: number
          nickname?: string
          region?: string | null
          riot_puuid?: string | null
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      queue: {
        Row: {
          elo: number
          joined_at: string
          mode: string
          status: string
          user_id: string
        }
        Insert: {
          elo: number
          joined_at?: string
          mode?: string
          status?: string
          user_id: string
        }
        Update: {
          elo?: number
          joined_at?: string
          mode?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          match_id: string | null
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          match_id?: string | null
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          match_id?: string | null
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_decline_penalty: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_match_result: {
        Args: {
          p_assists: number
          p_deaths: number
          p_kills: number
          p_match_id: string
          p_result: string
        }
        Returns: Json
      }
      try_match_x1: { Args: { p_player_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
