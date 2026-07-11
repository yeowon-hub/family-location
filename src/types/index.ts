export type HouseholdRole = 'owner' | 'member'

export interface Household {
  id: string
  name: string
  inviteCode: string
  role: HouseholdRole
  memberCount: number
}

export interface MemberLocation {
  userId: string
  householdId: string
  lat: number
  lng: number
  accuracy?: number
  sharingEnabled: boolean
  displayName: string | null
  updatedAt: string
}
