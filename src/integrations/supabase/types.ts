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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_client_name: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          household_id: string
          id: string
          metadata: Json | null
          summary: string
        }
        Insert: {
          action: string
          actor_client_name?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          household_id: string
          id?: string
          metadata?: Json | null
          summary: string
        }
        Update: {
          action?: string
          actor_client_name?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          household_id?: string
          id?: string
          metadata?: Json | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          connected_by: string | null
          connection_key_ciphertext: string | null
          created_at: string
          google_account_email: string | null
          household_id: string
          id: string
          last_synced_at: string | null
          provider: string
          status: Database["public"]["Enums"]["calendar_status"]
        }
        Insert: {
          connected_by?: string | null
          connection_key_ciphertext?: string | null
          created_at?: string
          google_account_email?: string | null
          household_id: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["calendar_status"]
        }
        Update: {
          connected_by?: string | null
          connection_key_ciphertext?: string | null
          created_at?: string
          google_account_email?: string | null
          household_id?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["calendar_status"]
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_memberships: {
        Row: {
          household_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      imported_events: {
        Row: {
          all_day: boolean
          connection_id: string
          description: string | null
          end_at: string | null
          google_event_id: string
          household_id: string
          id: string
          location: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          connection_id: string
          description?: string | null
          end_at?: string | null
          google_event_id: string
          household_id: string
          id?: string
          location?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          connection_id?: string
          description?: string | null
          end_at?: string | null
          google_event_id?: string
          household_id?: string
          id?: string
          location?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          id: string
          list_id: string
          order_index: number
          title: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          list_id: string
          order_index?: number
          title: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          list_id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          archived: boolean
          created_at: string
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["list_kind"]
          name: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          household_id: string
          id?: string
          kind?: Database["public"]["Enums"]["list_kind"]
          name: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["list_kind"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived: boolean
          body: string
          created_at: string
          created_by: string | null
          household_id: string
          id: string
        }
        Insert: {
          archived?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
        }
        Update: {
          archived?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          display_name: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      routine_instances: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          household_id: string
          id: string
          routine_id: string
          scheduled_for: string
          started_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          household_id: string
          id?: string
          routine_id: string
          scheduled_for?: string
          started_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          household_id?: string
          id?: string
          routine_id?: string
          scheduled_for?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_instances_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_instances_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_step_completions: {
        Row: {
          completed_at: string
          completed_by: string | null
          instance_id: string
          step_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          instance_id: string
          step_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          instance_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_step_completions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "routine_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "routine_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_steps: {
        Row: {
          created_at: string
          id: string
          order_index: number
          routine_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          routine_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          routine_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_steps_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          active: boolean
          cadence: Database["public"]["Enums"]["routine_cadence"]
          created_at: string
          household_id: string
          id: string
          name: string
          order_index: number
          schedule: Json | null
        }
        Insert: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["routine_cadence"]
          created_at?: string
          household_id: string
          id?: string
          name: string
          order_index?: number
          schedule?: Json | null
        }
        Update: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["routine_cadence"]
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          order_index?: number
          schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "routines_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_window: Database["public"]["Enums"]["due_window"] | null
          household_id: string
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          repeat_rule: Json | null
          source: Database["public"]["Enums"]["task_source"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_window?: Database["public"]["Enums"]["due_window"] | null
          household_id: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          repeat_rule?: Json | null
          source?: Database["public"]["Enums"]["task_source"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_window?: Database["public"]["Enums"]["due_window"] | null
          household_id?: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          repeat_rule?: Json | null
          source?: Database["public"]["Enums"]["task_source"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
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
      accept_household_invite: { Args: { _token: string }; Returns: string }
      create_household: { Args: { _name: string }; Returns: string }
      current_household_id: { Args: { _user_id: string }; Returns: string }
      has_household_access: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      actor_type: "user" | "mcp"
      app_role: "admin" | "user"
      calendar_status: "active" | "needs_reauth" | "error"
      due_window: "morning" | "afternoon" | "evening"
      list_kind: "shopping" | "packing" | "errands" | "prep" | "other"
      member_role: "adult" | "child"
      routine_cadence: "daily" | "weekly" | "custom"
      task_priority: "low" | "normal" | "important"
      task_source: "ui" | "mcp"
      task_status: "open" | "in_progress" | "done" | "snoozed"
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
      actor_type: ["user", "mcp"],
      app_role: ["admin", "user"],
      calendar_status: ["active", "needs_reauth", "error"],
      due_window: ["morning", "afternoon", "evening"],
      list_kind: ["shopping", "packing", "errands", "prep", "other"],
      member_role: ["adult", "child"],
      routine_cadence: ["daily", "weekly", "custom"],
      task_priority: ["low", "normal", "important"],
      task_source: ["ui", "mcp"],
      task_status: ["open", "in_progress", "done", "snoozed"],
    },
  },
} as const
