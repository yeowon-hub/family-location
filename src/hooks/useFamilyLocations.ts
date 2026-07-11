import { useCallback, useEffect, useState } from 'react'
import { useHousehold } from '@/contexts/HouseholdContext'
import {
  fetchHouseholdLocations,
  setLocationSharingEnabled,
  subscribeHouseholdLocations,
} from '@/lib/locationShare'
import type { MemberLocation } from '@/types'

export function useFamilyLocations(userId: string | undefined) {
  const { household } = useHousehold()
  const [locations, setLocations] = useState<MemberLocation[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!household) {
      setLocations([])
      return
    }

    setLoading(true)
    const rows = await fetchHouseholdLocations(household.id)
    setLocations(rows)
    setLoading(false)
  }, [household])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!household) return

    const unsubscribe = subscribeHouseholdLocations(
      household.id,
      (updated) => {
        setLocations((prev) => {
          const idx = prev.findIndex((l) => l.userId === updated.userId)
          if (idx === -1) return [...prev, updated]
          const next = [...prev]
          next[idx] = updated
          return next
        })
      },
      (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refresh()
        }
      },
    )

    const pollId = window.setInterval(() => {
      void refresh()
    }, 30_000)

    return () => {
      unsubscribe?.()
      window.clearInterval(pollId)
    }
  }, [household, refresh])

  const setSharing = useCallback(
    async (enabled: boolean) => {
      if (!userId) return false
      const ok = await setLocationSharingEnabled(userId, enabled)
      if (ok) {
        setLocations((prev) =>
          prev.map((l) => (l.userId === userId ? { ...l, sharingEnabled: enabled } : l)),
        )
      }
      return ok
    },
    [userId],
  )

  const visibleLocations = locations.filter(
    (l) => l.sharingEnabled || l.userId === userId,
  )

  return {
    locations: visibleLocations,
    loading,
    refresh,
    setSharing,
    household,
  }
}
