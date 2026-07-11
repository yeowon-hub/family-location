import { useEffect, useRef } from 'react'
import type { MemberLocation } from '@/types'
import type { GeoPoint } from '@/lib/geo'

const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined

let scriptPromise: Promise<void> | null = null

function loadNaverMapsScript(): Promise<void> {
  if (window.naver?.maps) return Promise.resolve()
  if (!NAVER_CLIENT_ID) return Promise.reject(new Error('NAVER_MAP_CLIENT_ID missing'))

  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // ncpKeyId: 최신 NCP Maps SDK 파라미터
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('네이버 지도 스크립트 로드 실패'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

function memberMarkerHtml(name: string, isMe: boolean): string {
  const bg = isMe ? '#FFB88E' : '#4A90D9'
  const safe = name.replace(/</g, '&lt;')
  return `<div style="
    background:${bg};
    color:#fff;
    font-size:11px;
    font-weight:700;
    padding:4px 8px;
    border-radius:12px;
    border:2px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,.25);
    white-space:nowrap;
    transform:translate(-50%,-100%);
  ">${safe}</div>`
}

interface NaverMapViewProps {
  members: MemberLocation[]
  myUserId?: string
  liveLocation?: GeoPoint | null
  className?: string
}

export function NaverMapView({ members, myUserId, liveLocation, className = '' }: NaverMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<NaverMap | null>(null)
  const markersRef = useRef<Map<string, NaverMarker>>(new Map())

  useEffect(() => {
    if (!containerRef.current || !NAVER_CLIENT_ID) return

    let cancelled = false

    void loadNaverMapsScript().then(() => {
      if (cancelled || !containerRef.current || !window.naver?.maps) return

      const maps = window.naver.maps
      const focusMember =
        (myUserId ? members.find((m) => m.userId === myUserId) : undefined) ?? members[0]
      const focusPoint =
        liveLocation && myUserId
          ? liveLocation
          : focusMember
            ? { lat: focusMember.lat, lng: focusMember.lng }
            : null
      const center = focusPoint
        ? new maps.LatLng(focusPoint.lat, focusPoint.lng)
        : new maps.LatLng(37.5665, 126.978)

      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          center,
          zoom: 14,
          zoomControl: true,
          mapDataControl: false,
        })
      }

      const map = mapRef.current
      const activeIds = new Set(members.map((m) => m.userId))

      for (const [id, marker] of markersRef.current) {
        if (!activeIds.has(id)) {
          marker.setMap(null)
          markersRef.current.delete(id)
        }
      }

      const bounds = new maps.LatLngBounds()

      for (const member of members) {
        const isMe = member.userId === myUserId
        const point = isMe && liveLocation ? liveLocation : { lat: member.lat, lng: member.lng }
        const pos = new maps.LatLng(point.lat, point.lng)
        bounds.extend(pos)

        const label = member.displayName ?? '가족'
        const existing = markersRef.current.get(member.userId)

        if (existing) {
          existing.setPosition(pos)
        } else {
          const marker = new maps.Marker({
            position: pos,
            map,
            title: label,
            icon: {
              content: memberMarkerHtml(label, isMe),
              anchor: new maps.Point(0, 0),
            },
          })
          markersRef.current.set(member.userId, marker)
        }
      }

      if (focusPoint) {
        map.setCenter(new maps.LatLng(focusPoint.lat, focusPoint.lng))
        if (members.length === 1) {
          map.setZoom(16)
        }
      } else if (members.length > 1) {
        map.fitBounds(bounds, 48)
      }
    })

    return () => {
      cancelled = true
    }
  }, [members, myUserId, liveLocation])

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.setMap(null)
      }
      markersRef.current.clear()
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [])

  if (!NAVER_CLIENT_ID) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 ${className}`}>
        .env에 VITE_NAVER_MAP_CLIENT_ID를 설정해주세요
      </div>
    )
  }

  return <div ref={containerRef} className={`naver-map ${className}`} />
}
