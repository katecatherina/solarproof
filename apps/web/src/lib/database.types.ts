export type Json = string | number | boolean | null | { [key: string]: Json | unknown } | Json[] | Record<string, unknown>

export interface Database {
  public: {
    Tables: {
      cooperatives: {
        Row: { id: string; name: string; admin_address: string; created_at: string }
        Insert: { id?: string; name: string; admin_address: string; created_at?: string }
        Update: { id?: string; name?: string; admin_address?: string; created_at?: string }
        Relationships: []
      }
      meters: {
        Row: {
          id: string; cooperative_id: string; serial_number: string
          name: string; pubkey_hex: string; active: boolean; created_at: string
        }
        Insert: { id?: string; cooperative_id: string; serial_number: string; name: string; pubkey_hex: string; active: boolean; created_at?: string }
        Update: { id?: string; cooperative_id?: string; serial_number?: string; name?: string; pubkey_hex?: string; active?: boolean; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'meters_cooperative_id_fkey'
            columns: ['cooperative_id']
            isOneToOne: false
            referencedRelation: 'cooperatives'
            referencedColumns: ['id']
          }
        ]
      }
      readings: {
        Row: {
          id: string; meter_id: string; kwh: number; timestamp: string
          reading_hash: string; signature_hex: string
          anchor_tx_hash: string | null; mint_tx_hash: string | null
          anchored: boolean; minted: boolean
          mint_diagnosis: Json | null
        }
        Insert: {
          id?: string; meter_id: string; kwh: number; timestamp: string
          reading_hash: string; signature_hex: string
          anchor_tx_hash?: string | null; mint_tx_hash?: string | null
          anchored?: boolean; minted?: boolean
          mint_diagnosis?: Json | null
        }
        Update: {
          id?: string; meter_id?: string; kwh?: number; timestamp?: string
          reading_hash?: string; signature_hex?: string
          anchor_tx_hash?: string | null; mint_tx_hash?: string | null
          anchored?: boolean; minted?: boolean
          mint_diagnosis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'readings_meter_id_fkey'
            columns: ['meter_id']
            isOneToOne: false
            referencedRelation: 'meters'
            referencedColumns: ['id']
          }
        ]
      }
      idempotency_keys: {
        Row: {
          nonce: string; reading_id: string; response: Json; created_at: string
        }
        Insert: { nonce: string; reading_id: string; response: Json; created_at?: string }
        Update: { nonce?: string; reading_id?: string; response?: Json; created_at?: string }
        Relationships: []
      }
      certificates: {
        Row: {
          id: string; cooperative_id: string; reading_id: string
          reading_hash: string; mint_tx_hash: string; anchor_tx_hash: string
          kwh: number; issued_at: string; retired: boolean
          retired_at: string | null; retired_by: string | null
        }
        Insert: {
          id?: string; cooperative_id: string; reading_id: string
          reading_hash: string; mint_tx_hash: string; anchor_tx_hash: string
          kwh: number; issued_at?: string; retired?: boolean
          retired_at?: string | null; retired_by?: string | null
        }
        Update: {
          id?: string; cooperative_id?: string; reading_id?: string
          reading_hash?: string; mint_tx_hash?: string; anchor_tx_hash?: string
          kwh?: number; issued_at?: string; retired?: boolean
          retired_at?: string | null; retired_by?: string | null
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          id: string; cooperative_id: string; url: string; secret: string
          events: string[]; active: boolean; created_at: string
        }
        Insert: { id?: string; cooperative_id: string; url: string; secret: string; events: string[]; active?: boolean; created_at?: string }
        Update: { id?: string; cooperative_id?: string; url?: string; secret?: string; events?: string[]; active?: boolean; created_at?: string }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          id: string; endpoint_id: string; event: string; payload: Json
          status: string; attempts: number; response_status: number | null; created_at: string
        }
        Insert: { id?: string; endpoint_id: string; event: string; payload: Json; status: string; attempts: number; response_status?: number | null; created_at?: string }
        Update: { id?: string; endpoint_id?: string; event?: string; payload?: Json; status?: string; attempts?: number; response_status?: number | null; created_at?: string }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string; operator_id: string; action: string; resource_id: string | null
          ip_address: string | null; metadata: Json | null; created_at: string
        }
        Insert: { id?: string; operator_id: string; action: string; resource_id?: string | null; ip_address?: string | null; metadata?: Json | null; created_at?: string }
        Update: { id?: string; operator_id?: string; action?: string; resource_id?: string | null; ip_address?: string | null; metadata?: Json | null; created_at?: string }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string; type: string; payload: Json; status: 'pending' | 'running' | 'done' | 'failed'
          attempts: number; result: Json | null; error: string | null; created_at: string; updated_at: string
        }
        Insert: { id?: string; type: string; payload?: Json; status?: 'pending' | 'running' | 'done' | 'failed'; attempts?: number; result?: Json | null; error?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; type?: string; payload?: Json; status?: 'pending' | 'running' | 'done' | 'failed'; attempts?: number; result?: Json | null; error?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
