import { supabase } from '@/lib/supabase'
import type { MemberLocation } from '@/types'

function parseRow(row: Record<string, unknown>): MemberLocation {
  return {
    userId: row.user_id as string,
    householdId: row.household_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    accuracy: (row.accuracy as number) ?? undefined,
    sharingEnabled: Boolean(row.sharing_enabled),
    displayName: (row.display_name as string) ?? null,
    updatedAt: row.updated_at as string,
  }
}

export async function fetchHouseholdLocations(householdId: string): Promise<MemberLocation[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('member_locations')
    .select('user_id, household_id, lat, lng, accuracy, sharing_enabled, display_name, updated_at')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return data.map((row) => parseRow(row as Record<string, unknown>))
}

export async function upsertMyLocation(input: {
  householdId: string
  userId: string
  lat: number
  lng: number
  accuracy?: number
  displayName?: string | null
  sharingEnabled: boolean
}): Promise<boolean> {
  if (!supabase) return false

  const { error } = await supabase.from('member_locations').upsert(
    {
      user_id: input.userId,
      household_id: input.householdId,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      display_name: input.displayName ?? null,
      sharing_enabled: input.sharingEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  return !error
}

export async function setLocationSharingEnabled(
  userId: string,
  sharingEnabled: boolean,
): Promise<boolean> {
  if (!supabase) return false

  const { error } = await supabase
    .from('member_locations')
    .update({ sharing_enabled: sharingEnabled, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return !error
}

export function subscribeHouseholdLocations(
  householdId: string,
  onChange: (location: MemberLocation) => void,
): (() => void) | null {
  if (!supabase) return null

  const channel = supabase
    .channel(`locations:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'member_locations',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined
        if (row && payload.eventType !== 'DELETE') {
          onChange(parseRow(row))
        }
      },
    )
    .subscribe()

  return () => {
    void supabase!.removeChannel(channel)
  }
}
