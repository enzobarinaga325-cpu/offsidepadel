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
          bug_id: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action: string
          bug_id: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          bug_id?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          bug_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          user_id: string
        }
        Insert: {
          bug_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          user_id: string
        }
        Update: {
          bug_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      bugs: {
        Row: {
          actual_behavior: string | null
          assignee_id: string | null
          created_at: string
          description: string
          environment: string | null
          expected_behavior: string | null
          id: string
          project_id: string | null
          reporter_id: string
          severity: Database["public"]["Enums"]["bug_severity"]
          sla_deadline: string | null
          status: Database["public"]["Enums"]["bug_status"]
          steps_to_reproduce: string | null
          title: string
          tracking_id: string
          updated_at: string
        }
        Insert: {
          actual_behavior?: string | null
          assignee_id?: string | null
          created_at?: string
          description?: string
          environment?: string | null
          expected_behavior?: string | null
          id?: string
          project_id?: string | null
          reporter_id: string
          severity?: Database["public"]["Enums"]["bug_severity"]
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["bug_status"]
          steps_to_reproduce?: string | null
          title: string
          tracking_id?: string
          updated_at?: string
        }
        Update: {
          actual_behavior?: string | null
          assignee_id?: string | null
          created_at?: string
          description?: string
          environment?: string | null
          expected_behavior?: string | null
          id?: string
          project_id?: string | null
          reporter_id?: string
          severity?: Database["public"]["Enums"]["bug_severity"]
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["bug_status"]
          steps_to_reproduce?: string | null
          title?: string
          tracking_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bugs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          gender: Database["public"]["Enums"]["category_gender"]
          id: string
          level: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gender?: Database["public"]["Enums"]["category_gender"]
          id?: string
          level?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gender?: Database["public"]["Enums"]["category_gender"]
          id?: string
          level?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          bug_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bug_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bug_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          company_logo_url: string | null
          company_name: string
          company_size: string | null
          company_website: string | null
          created_at: string
          id: string
          industry: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_logo_url?: string | null
          company_name?: string
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_logo_url?: string | null
          company_name?: string
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          bracket_position: number
          court: string | null
          created_at: string
          group_id: string | null
          id: string
          next_match_id: string | null
          next_match_slot: string | null
          pair_a_id: string | null
          pair_b_id: string | null
          round: Database["public"]["Enums"]["match_round"]
          scheduled_at: string | null
          score: Json
          status: Database["public"]["Enums"]["match_status"]
          tournament_category_id: string | null
          tournament_id: string
          updated_at: string
          winner_pair_id: string | null
        }
        Insert: {
          bracket_position?: number
          court?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          next_match_id?: string | null
          next_match_slot?: string | null
          pair_a_id?: string | null
          pair_b_id?: string | null
          round: Database["public"]["Enums"]["match_round"]
          scheduled_at?: string | null
          score?: Json
          status?: Database["public"]["Enums"]["match_status"]
          tournament_category_id?: string | null
          tournament_id: string
          updated_at?: string
          winner_pair_id?: string | null
        }
        Update: {
          bracket_position?: number
          court?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          next_match_id?: string | null
          next_match_slot?: string | null
          pair_a_id?: string | null
          pair_b_id?: string | null
          round?: Database["public"]["Enums"]["match_round"]
          scheduled_at?: string | null
          score?: Json
          status?: Database["public"]["Enums"]["match_status"]
          tournament_category_id?: string | null
          tournament_id?: string
          updated_at?: string
          winner_pair_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_pair_a_id_fkey"
            columns: ["pair_a_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_pair_b_id_fkey"
            columns: ["pair_b_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_pair_id_fkey"
            columns: ["winner_pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_digest: boolean
          email_on_assignment: boolean
          email_on_comment: boolean
          email_on_new_bug: boolean
          email_on_sla_breach: boolean
          email_on_status_change: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_digest?: boolean
          email_on_assignment?: boolean
          email_on_comment?: boolean
          email_on_new_bug?: boolean
          email_on_sla_breach?: boolean
          email_on_status_change?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_digest?: boolean
          email_on_assignment?: boolean
          email_on_comment?: boolean
          email_on_new_bug?: boolean
          email_on_sla_breach?: boolean
          email_on_status_change?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pairs: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          player1_id: string
          player2_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          player1_id: string
          player2_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          player1_id?: string
          player2_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pairs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          city: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          level: string | null
          phone: string | null
          preferred_side: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          level?: string | null
          phone?: string | null
          preferred_side?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          level?: string | null
          phone?: string | null
          preferred_side?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          category_id: string | null
          created_at: string
          failed_pin_attempts: number
          first_name: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          last_login_at: string | null
          last_name: string | null
          locked_until: string | null
          phone: string | null
          phone_e164: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string
          failed_pin_attempts?: number
          first_name?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          locked_until?: string | null
          phone?: string | null
          phone_e164?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string
          failed_pin_attempts?: number
          first_name?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          locked_until?: string | null
          phone?: string | null
          phone_e164?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ranking_points: {
        Row: {
          awarded_at: string
          category_id: string | null
          created_at: string
          id: string
          pair_id: string | null
          player_id: string
          points: number
          position: number
          tournament_category_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          awarded_at?: string
          category_id?: string | null
          created_at?: string
          id?: string
          pair_id?: string | null
          player_id: string
          points?: number
          position: number
          tournament_category_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          awarded_at?: string
          category_id?: string | null
          created_at?: string
          id?: string
          pair_id?: string | null
          player_id?: string
          points?: number
          position?: number
          tournament_category_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_points_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_points_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_points_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_points_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          admin_comment: string | null
          admin_notes: string | null
          approval_reason: string | null
          created_at: string
          id: string
          invited_by: string | null
          level_diff: number | null
          pair_id: string
          partner_confirmed: boolean
          registered_at: string
          registered_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          tournament_category_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          admin_notes?: string | null
          approval_reason?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          level_diff?: number | null
          pair_id: string
          partner_confirmed?: boolean
          registered_at?: string
          registered_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          tournament_category_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          admin_notes?: string | null
          approval_reason?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          level_diff?: number | null
          pair_id?: string
          partner_confirmed?: boolean
          registered_at?: string
          registered_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          tournament_category_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: true
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          created_at: string
          games_against: number
          games_for: number
          group_id: string
          id: string
          lost: number
          pair_id: string
          played: number
          points: number
          sets_against: number
          sets_for: number
          updated_at: string
          won: number
        }
        Insert: {
          created_at?: string
          games_against?: number
          games_for?: number
          group_id: string
          id?: string
          lost?: number
          pair_id: string
          played?: number
          points?: number
          sets_against?: number
          sets_for?: number
          updated_at?: string
          won?: number
        }
        Update: {
          created_at?: string
          games_against?: number
          games_for?: number
          group_id?: string
          id?: string
          lost?: number
          pair_id?: string
          played?: number
          points?: number
          sets_against?: number
          sets_for?: number
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_categories: {
        Row: {
          category_id: string | null
          created_at: string
          gender: Database["public"]["Enums"]["tournament_gender"]
          id: string
          label: string | null
          max_pairs: number
          mode: Database["public"]["Enums"]["tournament_category_mode"]
          position: number
          registration_open: boolean
          status: Database["public"]["Enums"]["tournament_category_status"]
          suma_value: number | null
          tournament_id: string
          updated_at: string
          waitlist_enabled: boolean
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["tournament_gender"]
          id?: string
          label?: string | null
          max_pairs?: number
          mode?: Database["public"]["Enums"]["tournament_category_mode"]
          position?: number
          registration_open?: boolean
          status?: Database["public"]["Enums"]["tournament_category_status"]
          suma_value?: number | null
          tournament_id: string
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Update: {
          category_id?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["tournament_gender"]
          id?: string
          label?: string | null
          max_pairs?: number
          mode?: Database["public"]["Enums"]["tournament_category_mode"]
          position?: number
          registration_open?: boolean
          status?: Database["public"]["Enums"]["tournament_category_status"]
          suma_value?: number | null
          tournament_id?: string
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          tournament_category_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          tournament_category_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          tournament_category_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_groups_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_points_config: {
        Row: {
          category_id: string | null
          champion_points: number
          created_at: string
          finalist_points: number
          id: string
          participation_points: number
          quarterfinalist_points: number
          semifinalist_points: number
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          champion_points?: number
          created_at?: string
          finalist_points?: number
          id?: string
          participation_points?: number
          quarterfinalist_points?: number
          semifinalist_points?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          champion_points?: number
          created_at?: string
          finalist_points?: number
          id?: string
          participation_points?: number
          quarterfinalist_points?: number
          semifinalist_points?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_points_config_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_points_config_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          location: string
          max_pairs: number
          name: string
          prizes: string | null
          registration_deadline: string | null
          registration_fee: number
          registration_open: boolean
          rules: string | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          tournament_type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location: string
          max_pairs?: number
          name: string
          prizes?: string | null
          registration_deadline?: string | null
          registration_fee?: number
          registration_open?: boolean
          rules?: string | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          tournament_type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location?: string
          max_pairs?: number
          name?: string
          prizes?: string | null
          registration_deadline?: string | null
          registration_fee?: number
          registration_open?: boolean
          rules?: string | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          tournament_type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      profiles_public: {
        Row: {
          avatar_url: string | null
          category_id: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          job_title: string | null
          last_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          job_title?: string | null
          last_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          job_title?: string | null
          last_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_create_registration: {
        Args: {
          _player1: string
          _player2: string
          _tournament_category_id: string
        }
        Returns: string
      }
      admin_move_registration: {
        Args: { _new_tournament_category_id: string; _registration_id: string }
        Returns: undefined
      }
      admin_review_registration: {
        Args: { _approve: boolean; _comment: string; _registration_id: string }
        Returns: undefined
      }
      admin_set_user_active: {
        Args: { _active: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_user_category: {
        Args: { _category_id: string; _user_id: string }
        Returns: undefined
      }
      admin_update_user_profile: {
        Args: {
          _first_name: string
          _last_name: string
          _phone: string
          _user_id: string
        }
        Returns: undefined
      }
      category_level_int: { Args: { _level: string }; Returns: number }
      confirm_partner: {
        Args: { _accept: boolean; _registration_id: string }
        Returns: undefined
      }
      finalize_tournament: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      finalize_tournament_category: {
        Args: { _tournament_category_id: string }
        Returns: undefined
      }
      generate_fixture: {
        Args: { _groups_count?: number; _tournament_id: string }
        Returns: Json
      }
      generate_fixture_for_category: {
        Args: { _groups_count?: number; _tournament_category_id: string }
        Returns: Json
      }
      get_player_stats: { Args: { _player_id: string }; Returns: Json }
      get_ranking: {
        Args: { _category_id?: string; _from?: string; _to?: string }
        Returns: {
          avatar_url: string
          full_name: string
          player_id: string
          total_points: number
          tournaments_played: number
          wins: number
        }[]
      }
      get_team_members: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          job_title: string
          role: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_phone: { Args: { _phone: string }; Returns: string }
      notify_admins: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      notify_pair: {
        Args: {
          _body: string
          _link: string
          _pair_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      phone_login_precheck: {
        Args: { _phone: string }
        Returns: {
          active: boolean
          lock_until: string
          locked: boolean
          user_id: string
        }[]
      }
      phone_login_register_failure: {
        Args: { _phone: string }
        Returns: string
      }
      phone_login_register_success: {
        Args: { _phone: string }
        Returns: undefined
      }
      recompute_standings: { Args: { _group_id: string }; Returns: undefined }
      request_pair_registration: {
        Args: { _partner_user_id: string; _tournament_category_id: string }
        Returns: string
      }
      search_players: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          category_gender: string
          category_level: string
          category_name: string
          full_name: string
          user_id: string
        }[]
      }
      submit_match_result: {
        Args: { _match_id: string; _sets: Json; _walkover_winner?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      bug_severity: "critical" | "high" | "medium" | "low"
      bug_status:
        | "new"
        | "assigned"
        | "in_progress"
        | "testing"
        | "resolved"
        | "closed"
      category_gender: "male" | "female" | "mixed"
      match_round:
        | "groups"
        | "r64"
        | "r32"
        | "r16"
        | "qf"
        | "sf"
        | "final"
        | "third_place"
      match_status:
        | "scheduled"
        | "in_progress"
        | "finished"
        | "walkover"
        | "cancelled"
      registration_status: "pending" | "approved" | "rejected" | "waitlist"
      tournament_category_mode: "normal" | "suma"
      tournament_category_status: "open" | "in_progress" | "closed" | "finished"
      tournament_gender: "mens" | "womens" | "mixed"
      tournament_status:
        | "upcoming"
        | "open"
        | "full"
        | "in_progress"
        | "finished"
        | "cancelled"
      tournament_type: "elimination" | "groups_elimination" | "round_robin"
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
      bug_severity: ["critical", "high", "medium", "low"],
      bug_status: [
        "new",
        "assigned",
        "in_progress",
        "testing",
        "resolved",
        "closed",
      ],
      category_gender: ["male", "female", "mixed"],
      match_round: [
        "groups",
        "r64",
        "r32",
        "r16",
        "qf",
        "sf",
        "final",
        "third_place",
      ],
      match_status: [
        "scheduled",
        "in_progress",
        "finished",
        "walkover",
        "cancelled",
      ],
      registration_status: ["pending", "approved", "rejected", "waitlist"],
      tournament_category_mode: ["normal", "suma"],
      tournament_category_status: ["open", "in_progress", "closed", "finished"],
      tournament_gender: ["mens", "womens", "mixed"],
      tournament_status: [
        "upcoming",
        "open",
        "full",
        "in_progress",
        "finished",
        "cancelled",
      ],
      tournament_type: ["elimination", "groups_elimination", "round_robin"],
    },
  },
} as const
