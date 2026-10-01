export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      entries: {
        Row: {
          author: string | null;
          content: string | null;
          created_at: string;
          external_id: string;
          feed_id: string;
          id: string;
          last_seen_at: string;
          published_at: string | null;
          sort_at: string | null;
          summary: string | null;
          title: string | null;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          author?: string | null;
          content?: string | null;
          created_at?: string;
          external_id: string;
          feed_id: string;
          id?: string;
          last_seen_at?: string;
          published_at?: string | null;
          sort_at?: never;
          summary?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          author?: string | null;
          content?: string | null;
          created_at?: string;
          external_id?: string;
          feed_id?: string;
          id?: string;
          last_seen_at?: string;
          published_at?: string | null;
          sort_at?: never;
          summary?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entries_feed_id_fkey";
            columns: ["feed_id"];
            isOneToOne: false;
            referencedRelation: "feeds";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_states: {
        Row: {
          entry_id: string;
          read_at: string | null;
          starred_at: string | null;
          user_id: string;
        };
        Insert: {
          entry_id: string;
          read_at?: string | null;
          starred_at?: string | null;
          user_id?: string;
        };
        Update: {
          entry_id?: string;
          read_at?: string | null;
          starred_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entry_states_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entry_states_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entry_list";
            referencedColumns: ["id"];
          },
        ];
      };
      feeds: {
        Row: {
          consecutive_failure_count: number;
          created_at: string;
          description: string | null;
          etag: string | null;
          favicon_url: string | null;
          feed_url: string;
          id: string;
          last_error: string | null;
          last_fetched_at: string | null;
          last_modified: string | null;
          last_parsed_at: string | null;
          last_succeeded_at: string | null;
          next_fetch_at: string;
          refresh_interval_minutes: number;
          site_url: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          consecutive_failure_count?: number;
          created_at?: string;
          description?: string | null;
          etag?: string | null;
          favicon_url?: string | null;
          feed_url: string;
          id?: string;
          last_error?: string | null;
          last_fetched_at?: string | null;
          last_modified?: string | null;
          last_parsed_at?: string | null;
          last_succeeded_at?: string | null;
          next_fetch_at?: string;
          refresh_interval_minutes?: number;
          site_url?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          consecutive_failure_count?: number;
          created_at?: string;
          description?: string | null;
          etag?: string | null;
          favicon_url?: string | null;
          feed_url?: string;
          id?: string;
          last_error?: string | null;
          last_fetched_at?: string | null;
          last_modified?: string | null;
          last_parsed_at?: string | null;
          last_succeeded_at?: string | null;
          next_fetch_at?: string;
          refresh_interval_minutes?: number;
          site_url?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      entry_list: {
        Row: {
          author: string | null;
          content: string | null;
          excerpt_source: string | null;
          feed_id: string | null;
          feed_title: string | null;
          feed_url: string | null;
          id: string | null;
          is_read: boolean | null;
          is_starred: boolean | null;
          published_at: string | null;
          sort_at: string | null;
          starred_at: string | null;
          summary: string | null;
          title: string | null;
          url: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entries_feed_id_fkey";
            columns: ["feed_id"];
            isOneToOne: false;
            referencedRelation: "feeds";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      entry_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          feed_id: string;
          starred: number;
          total: number;
          unread: number;
        }[];
      };
      mark_entries_read: { Args: { p_feed_id?: string }; Returns: number };
      prune_entries: { Args: { p_read_days: number; p_unread_days: number }; Returns: number };
      set_entry_state: {
        Args: { p_entry_id: string; p_read?: boolean; p_starred?: boolean };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
