import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, Users, Home, UserPlus, MapPin, LogIn } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/contexts/HouseholdContext'
import { displayNameFromUser } from '@/lib/geo'

export function SetupPage() {
  const { user, loading: authLoading, signIn, signUp, signInWithKakao, signOut, isConfigured } = useAuth()
  const { household, loading, error, createHousehold, joinHousehold, clearError } = useHousehold()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [familyName, setFamilyName] = useState('우리 집')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [copied, setCopied] = useState(false)

  if (!isConfigured) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-gray-600">
        .env에 Supabase 설정이 필요합니다
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-gray-500">
        불러오는 중…
      </div>
    )
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setAuthError('')
    try {
      const result =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password)
      if (result.error) setAuthError(result.error.message)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '로그인 오류')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyCode = async () => {
    if (!household?.inviteCode) return
    await navigator.clipboard.writeText(household.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={22} className="text-brand" />
            <h1 className="text-lg font-bold text-gray-800">가족 위치 설정</h1>
          </div>
          {household && (
            <Link to="/" className="text-sm font-medium text-brand">
              지도 보기 →
            </Link>
          )}
        </div>

        {!user ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === 'login' ? 'bg-white shadow' : 'text-gray-500'}`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === 'signup' ? 'bg-white shadow' : 'text-gray-500'}`}
              >
                회원가입
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                minLength={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand focus:outline-none"
              />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <LogIn size={16} />
                {submitting ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => void signInWithKakao()}
              className="mt-3 w-full rounded-xl bg-[#FEE500] py-3 text-sm font-semibold text-gray-900"
            >
              카카오로 시작
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
              <p className="text-sm font-semibold text-gray-800">{displayNameFromUser(user)}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 text-xs text-gray-400 underline"
              >
                로그아웃
              </button>
            </div>

            {loading && !household ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                가족 정보 불러오는 중…
              </div>
            ) : household ? (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Users size={20} className="text-brand" />
                  <h2 className="font-bold text-gray-800">{household.name}</h2>
                </div>
                <div className="space-y-2 rounded-xl bg-brand/10 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">구성원</span>
                    <span className="font-medium">{household.memberCount}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">초대 코드</span>
                    <span className="font-bold tracking-widest">{household.inviteCode}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 py-2.5 text-sm text-brand"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? '복사됨' : '초대 코드 복사'}
                </button>
                <Link
                  to="/"
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand py-3 text-sm font-semibold text-white"
                >
                  지도에서 위치 보기
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-3 font-bold text-gray-800">가족 그룹 연결</h2>
                <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => { setHouseholdMode('create'); clearError() }}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm ${householdMode === 'create' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
                  >
                    <Home size={16} /> 만들기
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHouseholdMode('join'); clearError() }}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm ${householdMode === 'join' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
                  >
                    <UserPlus size={16} /> 참가
                  </button>
                </div>

                {householdMode === 'create' ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setSubmitting(true)
                      await createHousehold(familyName)
                      setSubmitting(false)
                    }}
                    className="space-y-3"
                  >
                    <input
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="가족 이름"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      가족 만들기
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setSubmitting(true)
                      await joinHousehold(inviteCode)
                      setSubmitting(false)
                    }}
                    className="space-y-3"
                  >
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="초대 코드"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg font-bold tracking-widest uppercase"
                      maxLength={8}
                      required
                    />
                    <button
                      type="submit"
                      disabled={submitting || inviteCode.trim().length < 6}
                      className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      가족 참가하기
                    </button>
                  </form>
                )}
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
