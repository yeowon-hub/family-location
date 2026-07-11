export const LOCATION_UPLOAD_INTERVAL_MS = 60_000
export const LOCATION_MIN_DISTANCE_M = 30

export const GEO_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20_000,
}

export interface GeoPoint {
  lat: number
  lng: number
  accuracy?: number
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function shouldUploadLocation(
  prev: GeoPoint | null,
  next: GeoPoint,
  lastUploadAt: number,
  now = Date.now(),
): boolean {
  if (!prev) return true
  if (now - lastUploadAt >= LOCATION_UPLOAD_INTERVAL_MS) return true
  return distanceMeters(prev, next) >= LOCATION_MIN_DISTANCE_M
}

export function formatLocationAge(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime()
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  return `${Math.floor(diff / 86_400_000)}일 전`
}

export function naverMapLink(lat: number, lng: number): string {
  return `https://map.naver.com/v5/search/${lat},${lng}`
}

export function googleMapLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function displayNameFromUser(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}): string {
  return (
    (user.user_metadata?.nickname as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    '가족'
  )
}
