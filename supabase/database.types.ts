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
      family_member_ingredients: {
        Row: {
          ingredient_id: number
          member_id: number
          relation: string
        }
        Insert: {
          ingredient_id: number
          member_id: number
          relation: string
        }
        Update: {
          ingredient_id?: number
          member_id?: number
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_member_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_member_ingredients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_member_meal_preferences: {
        Row: {
          meal_id: number
          member_id: number
          ne_plus_proposer: boolean
          note: number | null
          updated_at: string
        }
        Insert: {
          meal_id: number
          member_id: number
          ne_plus_proposer?: boolean
          note?: number | null
          updated_at?: string
        }
        Update: {
          meal_id?: number
          member_id?: number
          ne_plus_proposer?: boolean
          note?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_member_meal_preferences_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_member_meal_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          age: number | null
          created_at: string
          emoji: string
          id: number
          nom: string
          poids: number
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          emoji?: string
          id?: number
          nom: string
          poids?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          created_at?: string
          emoji?: string
          id?: number
          nom?: string
          poids?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_items: {
        Row: {
          created_at: string
          expiration: string | null
          id: number
          ingredient_id: number
          quantite: number
          unite: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiration?: string | null
          id?: number
          ingredient_id: number
          quantite: number
          unite?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiration?: string | null
          id?: number
          ingredient_id?: number
          quantite?: number
          unite?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fridge_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          delai_recettes_aimees_jours: number
          id: number
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delai_recettes_aimees_jours?: number
          id?: number
          nom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delai_recettes_aimees_jours?: number
          id?: number
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: number
          id: number
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: number
          id?: number
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: number
          id?: number
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          household_id: number
          id: number
          code: string
          revoked_at: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          household_id: number
          id?: number
          code: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: number
          id?: number
          code?: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          calories_pour_100g: number | null
          glucides_pour_100g: number | null
          id: number
          lipides_pour_100g: number | null
          nom: string
          poids_unites: Json | null
          prix_unitaire: number | null
          proteines_pour_100g: number | null
          rayon: string
          saison: string
          unite_prix: string | null
        }
        Insert: {
          calories_pour_100g?: number | null
          glucides_pour_100g?: number | null
          id?: number
          lipides_pour_100g?: number | null
          nom: string
          poids_unites?: Json | null
          prix_unitaire?: number | null
          proteines_pour_100g?: number | null
          rayon: string
          saison?: string
          unite_prix?: string | null
        }
        Update: {
          calories_pour_100g?: number | null
          glucides_pour_100g?: number | null
          id?: number
          lipides_pour_100g?: number | null
          nom?: string
          poids_unites?: Json | null
          prix_unitaire?: number | null
          proteines_pour_100g?: number | null
          rayon?: string
          saison?: string
          unite_prix?: string | null
        }
        Relationships: []
      }
      meal_history: {
        Row: {
          created_at: string
          id: number
          meal_id: number | null
          notes: string | null
          planned_date: string
          raison: string | null
          rating: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          meal_id?: number | null
          notes?: string | null
          planned_date: string
          raison?: string | null
          rating?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          meal_id?: number | null
          notes?: string | null
          planned_date?: string
          raison?: string | null
          rating?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_history_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ingredients: {
        Row: {
          est_optionnel: boolean
          ingredient_id: number
          meal_id: number
          quantite: number
          unite: string
        }
        Insert: {
          est_optionnel?: boolean
          ingredient_id: number
          meal_id: number
          quantite: number
          unite: string
        }
        Update: {
          est_optionnel?: boolean
          ingredient_id?: number
          meal_id?: number
          quantite?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories_par_portion: number | null
          conservation_jours: number | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          description: string | null
          difficulte: string
          fibres: number | null
          glucides: number | null
          id: number
          image_url: string | null
          instructions: string[]
          is_public: boolean
          lipides: number | null
          macros_verifiables: boolean
          portions_par_defaut: number
          proteines: number | null
          saison: string
          temps_cuisson: number | null
          temps_preparation: number
          titre: string
          type_repas: string
          updated_at: string
          ustensiles: string[]
        }
        Insert: {
          calories_par_portion?: number | null
          conservation_jours?: number | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          difficulte?: string
          fibres?: number | null
          glucides?: number | null
          id?: number
          image_url?: string | null
          instructions?: string[]
          is_public?: boolean
          lipides?: number | null
          macros_verifiables?: boolean
          portions_par_defaut?: number
          proteines?: number | null
          saison?: string
          temps_cuisson?: number | null
          temps_preparation: number
          titre: string
          type_repas: string
          updated_at?: string
          ustensiles?: string[]
        }
        Update: {
          calories_par_portion?: number | null
          conservation_jours?: number | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          difficulte?: string
          fibres?: number | null
          glucides?: number | null
          id?: number
          image_url?: string | null
          instructions?: string[]
          is_public?: boolean
          lipides?: number | null
          macros_verifiables?: boolean
          portions_par_defaut?: number
          proteines?: number | null
          saison?: string
          temps_cuisson?: number | null
          temps_preparation?: number
          titre?: string
          type_repas?: string
          updated_at?: string
          ustensiles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "meals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_meals: {
        Row: {
          est_reste_de: number | null
          jour_semaine: number
          meal_id: number | null
          plan_id: number
          repas_type: string
        }
        Insert: {
          est_reste_de?: number | null
          jour_semaine: number
          meal_id?: number | null
          plan_id: number
          repas_type: string
        }
        Update: {
          est_reste_de?: number | null
          jour_semaine?: number
          meal_id?: number | null
          plan_id?: number
          repas_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_meals_est_reste_de_fkey"
            columns: ["est_reste_de"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_meals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_restes: boolean
          batch_cooking: boolean
          batch_cooking_jour: number
          budget_hebdo: number | null
          calories_par_jour: number | null
          contexte_jours: Json
          created_at: string
          cuisines_preferees: string[] | null
          depense_reference_hebdo: number | null
          digest_envoye_le: string | null
          depense_reference_saisie_le: string | null
          desserts_activees: boolean
          email: string
          emails_transactionnels: boolean
          equipements: string[]
          full_name: string | null
          id: string
          rythme_desserts: string
          nb_personnes: number
          niveau_cuisine: string
          nouveaute: number
          utiliser_saison: boolean
          objectif: string
          onboarding_complete: boolean
          plan: string
          poids_famille: number
          prix_max_portion: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          temps_max_par_jour: Json
          temps_max_semaine: number
          temps_max_weekend: number
          updated_at: string
          welcome_email_envoye_le: string | null
        }
        Insert: {
          desserts_activees?: boolean
          rythme_desserts?: string
          auto_restes?: boolean
          batch_cooking?: boolean
          batch_cooking_jour?: number
          budget_hebdo?: number | null
          calories_par_jour?: number | null
          created_at?: string
          contexte_jours?: Json
          cuisines_preferees?: string[] | null
          depense_reference_hebdo?: number | null
          depense_reference_saisie_le?: string | null
          digest_envoye_le?: string | null
          email: string
          emails_transactionnels?: boolean
          equipements?: string[]
          full_name?: string | null
          id: string
          nb_personnes?: number
          niveau_cuisine?: string
          nouveaute?: number
          utiliser_saison?: boolean
          objectif?: string
          onboarding_complete?: boolean
          plan?: string
          poids_famille?: number
          prix_max_portion?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          temps_max_par_jour?: Json
          temps_max_semaine?: number
          temps_max_weekend?: number
          updated_at?: string
          welcome_email_envoye_le?: string | null
        }
        Update: {
          auto_restes?: boolean
          rythme_desserts?: string
          desserts_activees?: boolean
          batch_cooking?: boolean
          batch_cooking_jour?: number
          budget_hebdo?: number | null
          calories_par_jour?: number | null
          created_at?: string
          contexte_jours?: Json
          cuisines_preferees?: string[] | null
          depense_reference_hebdo?: number | null
          depense_reference_saisie_le?: string | null
          digest_envoye_le?: string | null
          email?: string
          emails_transactionnels?: boolean
          equipements?: string[]
          full_name?: string | null
          id?: string
          nb_personnes?: number
          niveau_cuisine?: string
          nouveaute?: number
          utiliser_saison?: boolean
          objectif?: string
          onboarding_complete?: boolean
          plan?: string
          poids_famille?: number
          prix_max_portion?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          temps_max_par_jour?: Json
          temps_max_semaine?: number
          temps_max_weekend?: number
          updated_at?: string
          welcome_email_envoye_le?: string | null
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          checked: boolean
          ingredient_id: number
          list_id: number
          quantite_totale: number
          rayon: string
          unite: string
        }
        Insert: {
          checked?: boolean
          ingredient_id: number
          list_id: number
          quantite_totale: number
          rayon: string
          unite: string
        }
        Update: {
          checked?: boolean
          ingredient_id?: number
          list_id?: number
          quantite_totale?: number
          rayon?: string
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          generated_at: string
          id: number
          is_active: boolean
          plan_id: number | null
          user_id: string | null
        }
        Insert: {
          generated_at?: string
          id?: number
          is_active?: boolean
          plan_id?: number | null
          user_id?: string | null
        }
        Update: {
          generated_at?: string
          id?: number
          is_active?: boolean
          plan_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_allergies: {
        Row: {
          ingredient_id: number
          user_id: string
        }
        Insert: {
          ingredient_id: number
          user_id: string
        }
        Update: {
          ingredient_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_allergies_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_allergies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_diets: {
        Row: {
          regime: string
          user_id: string
        }
        Insert: {
          regime: string
          user_id: string
        }
        Update: {
          regime?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_diets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dislikes: {
        Row: {
          ingredient_id: number
          user_id: string
        }
        Insert: {
          ingredient_id: number
          user_id: string
        }
        Update: {
          ingredient_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dislikes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dislikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_meal_preferences: {
        Row: {
          frequence_jours: number | null
          jour_prefere: number | null
          meal_id: number
          ne_plus_proposer: boolean
          note: number | null
          repas_prefere: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          frequence_jours?: number | null
          jour_prefere?: number | null
          meal_id: number
          ne_plus_proposer?: boolean
          note?: number | null
          repas_prefere?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          frequence_jours?: number | null
          jour_prefere?: number | null
          meal_id?: number
          ne_plus_proposer?: boolean
          note?: number | null
          repas_prefere?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_meal_preferences_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_meal_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prix_ingredients: {
        Row: {
          ingredient_id: number
          prix_unitaire: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ingredient_id: number
          prix_unitaire: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ingredient_id?: number
          prix_unitaire?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prix_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_prix_ingredients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_budget_snapshots: {
        Row: {
          budget: number
          created_at: string
          depense: number
          depense_reelle: number | null
          economie: number
          id: number
          nb_personnes: number
          semaine_debut: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          budget?: number
          created_at?: string
          depense?: number
          depense_reelle?: number | null
          economie?: number
          id?: number
          nb_personnes?: number
          semaine_debut: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          budget?: number
          created_at?: string
          depense?: number
          depense_reelle?: number | null
          economie?: number
          id?: number
          nb_personnes?: number
          semaine_debut?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_budget_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plans: {
        Row: {
          cuisines_diversifiees: string[]
          fallback_utilise: boolean
          generated_at: string
          id: number
          is_active: boolean
          semaine_debut: string
          user_id: string | null
        }
        Insert: {
          cuisines_diversifiees?: string[]
          fallback_utilise?: boolean
          generated_at?: string
          id?: number
          is_active?: boolean
          semaine_debut: string
          user_id?: string | null
        }
        Update: {
          cuisines_diversifiees?: string[]
          fallback_utilise?: boolean
          generated_at?: string
          id?: number
          is_active?: boolean
          semaine_debut?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      quantite_achat_liste: {
        Args: { p_quantite: number; p_unite: string; p_unite_prix: string }
        Returns: number | null
      }
      recompute_shopping_list: {
        Args: { p_plan_id: number }
        Returns: number | null
      }
      recompute_shopping_list_frigo: {
        Args: { p_plan_id: number }
        Returns: number | null
      }
      save_family_member: {
        Args: {
          p_user_id: string
          p_nom: string
          p_membre_id?: number | null
          p_emoji?: string
          p_poids?: number
          p_age?: number | null
          p_ingredients?: Json
          p_preferences?: Json
        }
        Returns: number
      }
      ensure_household: {
        Args: { p_nom?: string }
        Returns: number
      }
      household_invite: {
        Args: { p_days?: number }
        Returns: string
      }
      household_join: {
        Args: { p_code: string }
        Returns: number
      }
      household_leave: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      household_remove_member: {
        Args: { p_member_user_id: string }
        Returns: undefined
      }
      household_annuler_invitation: {
        Args: { p_invitation_id: number }
        Returns: undefined
      }
      household_list_members: {
        Args: Record<PropertyKey, never>
        Returns: { user_id: string; role: string; joined_at: string; nom: string }[]
      }
      save_weekly_plan: {
        Args: {
          p_user_id: string
          p_semaine_debut: string
          p_days: Json
          p_fallback_utilise?: boolean
          p_cuisines_diversifiees?: Json
        }
        Returns: { plan_id: number; shopping_list_id: number }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
