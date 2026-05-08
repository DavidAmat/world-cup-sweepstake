export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      fixtures: {
        Row: {
          away_placeholder: string | null
          away_team_id: string | null
          created_at: string
          external_id: string | null
          group_code: string | null
          home_placeholder: string | null
          home_team_id: string | null
          id: string
          kickoff_at: string
          round_id: string
          stage_id: string
          status: string
          tournament_id: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_placeholder?: string | null
          away_team_id?: string | null
          created_at?: string
          external_id?: string | null
          group_code?: string | null
          home_placeholder?: string | null
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          round_id: string
          stage_id: string
          status?: string
          tournament_id: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_placeholder?: string | null
          away_team_id?: string | null
          created_at?: string
          external_id?: string | null
          group_code?: string | null
          home_placeholder?: string | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          round_id?: string
          stage_id?: string
          status?: string
          tournament_id?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      group_qualification_predictions: {
        Row: {
          created_at: string
          group_code: string
          id: string
          predicted_position: number | null
          team_id: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_code: string
          id?: string
          predicted_position?: number | null
          team_id: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_code?: string
          id?: string
          predicted_position?: number | null
          team_id?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_qualification_predictions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_qualification_predictions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_qualification_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      initial_predictions: {
        Row: {
          best_player_id: string | null
          champion_team_id: string | null
          created_at: string
          id: string
          locked_at: string | null
          runner_up_team_id: string | null
          submitted_at: string | null
          top_scorer_player_id: string | null
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          best_player_id?: string | null
          champion_team_id?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          runner_up_team_id?: string | null
          submitted_at?: string | null
          top_scorer_player_id?: string | null
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          best_player_id?: string | null
          champion_team_id?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          runner_up_team_id?: string | null
          submitted_at?: string | null
          top_scorer_player_id?: string | null
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "initial_predictions_best_player_id_fkey"
            columns: ["best_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_predictions_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_predictions_runner_up_team_id_fkey"
            columns: ["runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_predictions_top_scorer_player_id_fkey"
            columns: ["top_scorer_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_predictions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      match_goals: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          minute: number | null
          own_goal: boolean
          penalty_goal: boolean
          period: string | null
          player_id: string | null
          team_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          minute?: number | null
          own_goal?: boolean
          penalty_goal?: boolean
          period?: string | null
          player_id?: string | null
          team_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          minute?: number | null
          own_goal?: boolean
          penalty_goal?: boolean
          period?: string | null
          player_id?: string | null
          team_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_goals_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          away_goals_120: number | null
          away_goals_90: number
          created_at: string
          fixture_id: string
          home_goals_120: number | null
          home_goals_90: number
          id: string
          predicted_qualified_team_id: string | null
          predicted_winner_team_id: string | null
          predicts_extra_time: boolean
          predicts_penalties: boolean
          submitted_at: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          away_goals_120?: number | null
          away_goals_90: number
          created_at?: string
          fixture_id: string
          home_goals_120?: number | null
          home_goals_90: number
          id?: string
          predicted_qualified_team_id?: string | null
          predicted_winner_team_id?: string | null
          predicts_extra_time?: boolean
          predicts_penalties?: boolean
          submitted_at?: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          away_goals_120?: number | null
          away_goals_90?: number
          created_at?: string
          fixture_id?: string
          home_goals_120?: number | null
          home_goals_90?: number
          id?: string
          predicted_qualified_team_id?: string | null
          predicted_winner_team_id?: string | null
          predicts_extra_time?: boolean
          predicts_penalties?: boolean
          submitted_at?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_predicted_qualified_team_id_fkey"
            columns: ["predicted_qualified_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_predicted_winner_team_id_fkey"
            columns: ["predicted_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      match_results: {
        Row: {
          away_goals_120: number | null
          away_goals_90: number
          created_at: string
          created_by: string | null
          fixture_id: string
          home_goals_120: number | null
          home_goals_90: number
          id: string
          penalty_winner_team_id: string | null
          qualified_team_id: string | null
          result_status: string
          tournament_id: string
          updated_at: string
          went_extra_time: boolean
          went_penalties: boolean
          winner_team_id: string | null
        }
        Insert: {
          away_goals_120?: number | null
          away_goals_90: number
          created_at?: string
          created_by?: string | null
          fixture_id: string
          home_goals_120?: number | null
          home_goals_90: number
          id?: string
          penalty_winner_team_id?: string | null
          qualified_team_id?: string | null
          result_status?: string
          tournament_id: string
          updated_at?: string
          went_extra_time?: boolean
          went_penalties?: boolean
          winner_team_id?: string | null
        }
        Update: {
          away_goals_120?: number | null
          away_goals_90?: number
          created_at?: string
          created_by?: string | null
          fixture_id?: string
          home_goals_120?: number | null
          home_goals_90?: number
          id?: string
          penalty_winner_team_id?: string | null
          qualified_team_id?: string | null
          result_status?: string
          tournament_id?: string
          updated_at?: string
          went_extra_time?: boolean
          went_penalties?: boolean
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_results_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_penalty_winner_team_id_fkey"
            columns: ["penalty_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_qualified_team_id_fkey"
            columns: ["qualified_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_stats: {
        Row: {
          assists: number
          created_at: string
          fixture_id: string
          goals: number
          id: string
          minutes_played: number | null
          player_id: string
          red_cards: number
          team_id: string
          tournament_id: string
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          assists?: number
          created_at?: string
          fixture_id: string
          goals?: number
          id?: string
          minutes_played?: number | null
          player_id: string
          red_cards?: number
          team_id: string
          tournament_id: string
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          assists?: number
          created_at?: string
          fixture_id?: string
          goals?: number
          id?: string
          minutes_played?: number | null
          player_id?: string
          red_cards?: number
          team_id?: string
          tournament_id?: string
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_match_stats_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          aliases: Json
          canonical_name: string
          created_at: string
          display_name: string
          external_id: string | null
          id: string
          team_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: Json
          canonical_name: string
          created_at?: string
          display_name: string
          external_id?: string | null
          id?: string
          team_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: Json
          canonical_name?: string
          created_at?: string
          display_name?: string
          external_id?: string | null
          id?: string
          team_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          initials: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          initials: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          initials?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          stage_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order: number
          stage_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          stage_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          score_multiplier: number
          sort_order: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          score_multiplier?: number
          sort_order: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          score_multiplier?: number
          sort_order?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          aliases: Json
          canonical_name: string
          code: string
          created_at: string
          display_name: string
          external_id: string | null
          group_code: string | null
          id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          aliases?: Json
          canonical_name: string
          code: string
          created_at?: string
          display_name: string
          external_id?: string | null
          group_code?: string | null
          id?: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          aliases?: Json
          canonical_name?: string
          code?: string
          created_at?: string
          display_name?: string
          external_id?: string | null
          group_code?: string | null
          id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          id: string
          rules_version: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          rules_version: number
          tournament_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          rules_version?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          group_qualifiers_per_group: number
          id: string
          is_test: boolean
          name: string
          predictions_open_until: string | null
          slug: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          group_qualifiers_per_group?: number
          id?: string
          is_test?: boolean
          name: string
          predictions_open_until?: string | null
          slug: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          group_qualifiers_per_group?: number
          id?: string
          is_test?: boolean
          name?: string
          predictions_open_until?: string | null
          slug?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_fixture_locked: { Args: { p_fixture_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

