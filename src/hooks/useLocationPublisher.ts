import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useHousehold } from '@/contexts/HouseholdContext'
import {
  GEO_WATCH_OPTIONS,
  shouldUploadLocation,
  displayNameFromUser,
  type GeoPoint,
} from '@/lib/geo'
import { upsertMyLocation } from '@/lib/locationShare'

const SHARING_KEY = 'family_location_sharing'

function readSharingPref(): boolean {
  try {
    const v = localStorage.getItem(SHARING_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

function writeSharingPref(enabled: boolean) {
  try {
    localStorage.setItem(SHARING_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function useLocationPublisher(user: User | null) {
  const { household } = useHousehold()
  const [sharingEnabled, setSharingEnabled] = useState(readSharingPref)
  const [publishing, setPublishing] = useState(false)
  const [lastUploadedAt, setLastUploadedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lastPointRef = useRef<GeoPoint | null>(null)
  const lastUploadMsRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)

  const displayName = user ? displayNameFromUser(user) : '나'

  const upload = useCallback(
    async (point: GeoPoint) => {
      if (!user || !household || !sharingEnabled) return

      const result = await upsertMyLocation({
        householdId: household.id,
        userId: user.id,
        lat: point.lat,
        lng: point.lng,
        accuracy: point.accuracy,
        displayName,
        sharingEnabled: true,
      })

      if (result.ok) {
        lastPointRef.current = point
        lastUploadMsRef.current = Date.now()
        setLastUploadedAt(new Date().toISOString())
        setError(null)
      } else {
        setError(result.error ?? '위치 전송 실패')
      }
    },
    [user, household, sharingEnabled, displayName],
  )

  const toggleSharing = useCallback((enabled: boolean) => {
    setSharingEnabled(enabled)
    writeSharingPref(enabled)
  }, [])

  useEffect(() => {
    if (!user || !household || !sharingEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setPublishing(false)
      return
    }

    if (!navigator.geolocation) {
      setError('이 기기에서 위치 기능을 사용할 수 없습니다')
      return
    }

    setPublishing(true)
    setError(null)

    const handlePosition = (pos: GeolocationPosition) => {
      const point: GeoPoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }

      if (shouldUploadLocation(lastPointRef.current, point, lastUploadMsRef.current)) {
        void upload(point)
      }
    }

    const handleError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setError('위치 권한을 허용해주세요')
      } else if (err.code === err.TIMEOUT) {
        setError('위치를 가져오지 못했습니다')
      }
      setPublishing(false)
    }

    navigator.geolocation.getCurrentPosition(handlePosition, handleError, GEO_WATCH_OPTIONS)

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      GEO_WATCH_OPTIONS,
    )

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point: GeoPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          void upload(point)
        },
        () => undefined,
        GEO_WATCH_OPTIONS,
      )
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisibility)
      setPublishing(false)
    }
  }, [user, household, sharingEnabled, upload])

  return {
    sharingEnabled,
    toggleSharing,
    publishing,
    lastUploadedAt,
    error,
    displayName,
  }
}