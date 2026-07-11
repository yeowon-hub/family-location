import { Link } from 'react-router-dom'
import { MapPin, Navigation, RefreshCw, Users, ExternalLink, Settings, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useFamilyLocations } from '@/hooks/useFamilyLocations'
import { useLiveLocation } from '@/hooks/useLiveLocation'
import { useLocationPublisher } from '@/hooks/useLocationPublisher'
import { NaverMapView } from '@/components/location/NaverMapView'
import { formatLocationAge, googleMapLink, naverMapLink } from '@/lib/geo'

export function LocationPage() {
  const { user } = useAuth()
  const { locations, loading, refresh, household } = useFamilyLocations(user?.id)
  const publisher = useLocationPublisher(user)
  const live = useLiveLocation(Boolean(user && household && publisher.sharingEnabled))

  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <MapPin size={32} className="text-brand/60" />
        <p className="text-sm text-gray-600">위치 공유는 로그인 후 이용할 수 있어요</p>
        <Link
          to="/setup"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          로그인하기
        </Link>
      </div>
    )
  }

  if (!household) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Users size={32} className="text-brand/60" />
        <p className="text-sm text-gray-600">
          가족 그룹에 참여하면
          <br />
          구성원 위치를 지도에서 볼 수 있어요
        </p>
        <Link
          to="/setup"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          가족 설정하기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <NaverMapView
          members={locations}
          myUserId={user.id}
          liveLocation={live.point}
          className="absolute inset-0 h-full w-full"
        />

        {!live.isSecureContext && (
          <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-800 shadow-sm">
            휴대폰 GPS는 HTTPS에서만 정확해요. Vercel 주소나 https://192.168.x.x:5174 로 접속하세요.
          </div>
        )}

        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <div className="rounded-xl bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold text-gray-800">{household.name}</p>
            <p className="text-[10px] text-gray-500">
              {household.memberCount}명 · 실시간 갱신
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/chemo"
              className="rounded-full bg-white/95 p-2 shadow-sm backdrop-blur"
              aria-label="Chemo Crosscheck Care"
            >
              <ShieldCheck size={18} className="text-gray-600" />
            </Link>
            <Link
              to="/setup"
              className="rounded-full bg-white/95 p-2 shadow-sm backdrop-blur"
              aria-label="설정"
            >
              <Settings size={18} className="text-gray-600" />
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full bg-white/95 p-2 shadow-sm backdrop-blur"
              aria-label="새로고침"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-gray-500' : 'text-gray-600'} />
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 safe-bottom">
        <div className="mb-3 flex items-center justify-between rounded-xl bg-brand/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-brand" />
            <div>
              <p className="text-xs font-semibold text-gray-800">내 위치 공유</p>
              <p className="text-[10px] text-gray-500">
                {publisher.sharingEnabled
                  ? publisher.publishing
                    ? publisher.lastUploadedAt
                      ? `마지막 전송 ${formatLocationAge(publisher.lastUploadedAt)}`
                      : '위치 전송 중…'
                    : '대기 중'
                  : '꺼짐'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={publisher.sharingEnabled}
              onChange={(e) => publisher.toggleSharing(e.target.checked)}
            />
            <span className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-brand" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </label>
        </div>

        {publisher.error && (
          <p className="mb-2 text-center text-xs text-red-500">{publisher.error}</p>
        )}
        {live.error && (
          <p className="mb-2 text-center text-xs text-red-500">{live.error}</p>
        )}
        {live.point?.accuracy && live.point.accuracy > 200 && (
          <p className="mb-2 text-center text-xs text-amber-600">
            GPS 정확도 ±{Math.round(live.point.accuracy)}m — PC에서는 부정확할 수 있어요. 휴대폰에서 확인하세요.
          </p>
        )}

        <div className="max-h-36 space-y-2 overflow-y-auto">
          {locations.length === 0 && !loading && (
            <p className="py-4 text-center text-xs text-gray-400">
              아직 공유된 위치가 없어요. 위치 공유를 켜주세요.
            </p>
          )}
          {locations.map((member) => {
            const isMe = member.userId === user.id
            const livePoint = isMe ? live.point : null
            const lat = livePoint?.lat ?? member.lat
            const lng = livePoint?.lng ?? member.lng
            const accuracy = livePoint?.accuracy ?? member.accuracy
            const name = member.displayName ?? (isMe ? '나' : '가족')
            return (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {name}
                    {isMe && (
                      <span className="ml-1 text-[10px] font-normal text-brand">(나)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {livePoint ? '실시간 GPS' : formatLocationAge(member.updatedAt)}
                    {accuracy ? ` · ±${Math.round(accuracy)}m` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a
                    href={naverMapLink(lat, lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700"
                  >
                    네이버
                  </a>
                  <a
                    href={googleMapLink(lat, lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700"
                  >
                    <ExternalLink size={10} />
                    구글
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-2 text-center text-[10px] text-gray-400">
          15m 이상 이동 또는 30초마다 서버에 전송 · SKT 등 모든 통신사 지원
        </p>
      </div>
    </div>
  )
}
