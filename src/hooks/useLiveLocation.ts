import { useEffect, useState } from 'react'
import { GEO_WATCH_OPTIONS, type GeoPoint } from '@/lib/geo'

export function useLiveLocation(enabled: boolean) {
  const [point, setPoint] = useState<GeoPoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSecureContext =
    typeof window !== 'undefined' ? window.isSecureContext : true

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setPoint(null)
      return
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      })
      setError(null)
    }

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setError('위치 권한을 허용해주세요')
      } else {
        setError('현재 위치를 가져오지 못했습니다')
      }
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, GEO_WATCH_OPTIONS)
    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, GEO_WATCH_OPTIONS)

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled])

  return { point, error, isSecureContext }
}
