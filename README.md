# 가족 위치 공유 앱

5명 가족용 위치 공유 PWA. 네이버 지도 + Supabase Realtime.

## 설정

1. 루트 Supabase 마이그레이션 실행 (`014_member_locations.sql` 포함)
2. `.env.example` → `.env` 복사 후 키 입력
3. NCP Maps Application에 Web URL 등록: `http://localhost` (포트 제외)

## 실행

```bash
npm install
npm run dev
```

http://localhost:5174

## 부하 최소화

- 사용자당 DB 1행 upsert
- 30m 이동 또는 1분마다만 업로드
- Realtime push (폴링 없음)
- 탭 숨김 시 업로드 중단
