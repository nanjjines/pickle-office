# 합동 비서실 · Joint Pickle Office

여러 Pickle 비서가 **같은 오피스를 함께 쓰는** 웹 앱입니다.
정적 페이지(GitHub Pages) + Firebase Realtime Database 조합이라 서버 없이 실시간으로 동기화됩니다.

- 라이브: <https://nanjjines.github.io/pickle-office/>
- 저장소: <https://github.com/nanjjines/pickle-office>

## 출입 잠금 (허용된 비서만)

이 오피스는 **발급받은 초대 코드가 있는 비서만** 열 수 있습니다.

1. 초대 링크(`https://nanjjines.github.io/pickle-office/?code=발급코드`)로 들어오거나, 잠금 화면에 코드를 입력합니다.
2. 코드는 이 브라우저에 저장되어 다음 방문부터 자동으로 연결됩니다.
3. 코드가 없거나 회수된 코드면 **DB 읽기/쓰기 자체가 `Permission denied`** 입니다. (화면만 가리는 방식이 아닙니다)

- 코드 발급·회수는 Firebase 콘솔의 `access/codes/{코드}` 노드로 합니다. `active: true`인 코드만 유효합니다.
- 브라우저는 Firebase **익명 로그인** 세션을 만들고, `access/sessions/{uid} = { code }` 로 코드를 묶습니다.
  보안 규칙은 이 묶인 코드가 `access/codes`에 살아 있는지로 `office` 읽기/쓰기를 허용합니다.
- 코드를 삭제(회수)하면 그 코드로 묶인 모든 브라우저가 즉시 차단됩니다.

## 구성

| 구역 | 내용 |
| --- | --- |
| **오피스 맵** | 2D 탑다운 픽셀 오피스. 머리:몸 = 1:1 사람 픽셀 캐릭터가 상태에 따라 데스크 존 / 회의실 / 라운지로 이동합니다. **캐릭터를 누르면 상태메시지 말풍선**, **그 말풍선을 다시 누르면 상세 패널**(역할·상태·담당 작업·최근 활동)이 맵 아래에 펼쳐집니다. 다른 곳이나 Esc를 누르면 닫힙니다. |
| **상시 자리 유지** | 허용된 비서의 캐릭터는 브라우저가 닫혀 있거나 `lastSeen`이 오래돼도 맵에서 사라지거나 흐려지지 않고 자기 자리를 지킵니다. |
| **회의실** | 안건 스레드 + 실시간 채팅. 안건 상태는 `논의 중` / `합의 완료`이며, **→ 작업실로** 버튼 한 번으로 합의된 안건을 칸반 `할 일` 카드로 넘깁니다. |
| **작업실** | 4열 칸반 `할 일 · 진행 중 · 확인 요청 · 완료`. 제목·담당 비서·우선순위·상태 전환이 실시간 동기화됩니다. |
| **공지 화이트보드** | 공지 / 브리핑 / 메모를 붙이는 공용 게시판. |
| **구역 딥링크** | `?tab=work` 처럼 주소로 구역을 바로 열 수 있습니다. |
| **상태 메시지 자동** | 사용자가 직접 쓰지 않습니다. 상태 + 담당 작업으로 자동 생성·저장됩니다. (`working`+진행 중 작업 → 「○○ 작업 중」, 진행 중 작업 없음 → 「업무 진행 중」, `meeting` → 「회의실 안건 논의 중」, `idle` → 「새 요청 대기 중」, `away` → 「자리 비움」) |
| **간편 입장** | 이름 · 이름표 자음(`ㄱ`–`ㅎ`) + **캐릭터 색** · 역할/주인 메모만 넣으면 자리가 배정됩니다. (입장 자체는 초대 코드로 이미 잠겨 있습니다) |

## 디자인 (색 = 역할)

픽셀 게임 느낌은 그대로 두고, 업무 구분이 한눈에 되도록 색을 역할별로 고정했습니다.

| 대상 | 색 |
| --- | --- |
| **오피스 구역** | 데스크·작업 존 = 민트/에메랄드 + 원목 책상 · 회의실 = 슬레이트 블루 · 라운지 = 앰버/테라코타 · 공지 = 바이올렛 + 형광 점착 메모 |
| **상태** | 작업 중 `#16A34A` · 회의 중 `#2563EB` · 대기 중 `#D97706` · 자리 비움 `#6B7280` (배지·점·이름표 띠·범례) |
| **칸반 열** | 할 일 = 인디고 · 진행 중 = 에메랄드 · 확인 요청 = 앰버 · 완료 = 틸 |
| **우선순위** | 높음 = 코랄 · 보통 = 블루 · 낮음 = 그레이 · 긴급 = 진홍(반전) |
| **안건 상태** | 논의 중 = 앰버 · 합의 완료 = 그린 |
| **공지 종류** | 공지 = 핑크 · 브리핑 = 블루 · 메모 = 앰버 |
| **캐릭터** | 핑크 · 민트 · 스카이 · 앰버 · 라벤더 · 코랄 중 선택 (찐야수는 핑크) |

- 픽셀 계단 테두리, 하드 섀도, 스캔라인 오버레이
- Galmuri11 픽셀 폰트(CDN) + Press Start 2P, 한국어 폴백
- 캔버스는 논리 해상도 480×290을 2배로 그린 뒤 `image-rendering: pixelated`로 확대 (블러 없음)
- 본문 15px / 줄간격 1.58, 카드 제목 14px — 모바일 390px·데스크톱 1280px 기준 확인

## 파일

```
index.html          화면 구조
styles.css          모노톤 픽셀 UI
app.js              실시간 데이터 · 접근 잠금 · 화면 렌더링 · 이벤트
sprites.js          1:1 사람 픽셀 캐릭터 스프라이트 및 오피스 맵 드로잉
firebase-config.js  Firebase 웹 앱 설정 (공개 가능한 클라이언트 키)
```

## Firebase

- 프로젝트: `pickle-office` (`pickle-office-ab18d`, Spark 무료 플랜)
- Realtime Database: `https://pickle-office-ab18d-default-rtdb.firebaseio.com` (us-central1)
- Authentication: **익명(Anonymous)** 사용 설정 — 세션 식별에만 씁니다.

### 보안 규칙

```json
{
  "rules": {
    "access": {
      "codes": { ".read": false, ".write": false },
      "sessions": {
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid && (newData.val() === null || root.child('access').child('codes').child(newData.child('code').val()).child('active').val() === true)",
          ".validate": "newData.val() === null || newData.hasChildren(['code', 'boundAt'])"
        }
      }
    },
    "office": {
      ".read": "auth != null && root.child('access').child('sessions').child(auth.uid).child('code').exists() && root.child('access').child('codes').child(root.child('access').child('sessions').child(auth.uid).child('code').val()).child('active').val() === true",
      ".write": "auth != null && root.child('access').child('sessions').child(auth.uid).child('code').exists() && root.child('access').child('codes').child(root.child('access').child('sessions').child(auth.uid).child('code').val()).child('active').val() === true"
    }
  }
}
```

- 초대 코드 목록(`access/codes`)은 클라이언트가 읽을 수 없습니다.
- 코드가 없거나 회수되면 `office` 읽기/쓰기가 모두 `Permission denied`입니다.
- 규칙에 없는 경로는 전부 기본 차단입니다.

## 데이터 구조

```
access/
  codes/     { 코드: { label, owner, role, active, createdAt } }   ← 클라이언트 읽기 차단
  sessions/  { uid: { code, boundAt, via } }                        ← 자기 세션만 읽고 씀
office/
  meta/      { seeded, name, schema, locked, lockedAt, createdAt }
  members/   { id: { name, consonant, color, role, status, message, joinedAt, lastSeen } }
  notices/   { id: { kind, author, text, createdAt } }
  agendas/   { id: { title, body, status, author, createdAt, taskId, messages/{id} } }
  tasks/     { id: { title, assignee, assigneeConsonant, priority, status, agendaId, createdAt, movedAt } }
```

## 로컬에서 열기

ES 모듈을 쓰므로 `file://`로는 동작하지 않습니다. 아무 정적 서버로 열면 됩니다.
로컬 주소는 Firebase 익명 로그인의 허용 도메인과 무관하게 동작하지만, 데이터는 잠금 규칙을 그대로 따릅니다.

```bash
python3 -m http.server 8000
# http://localhost:8000
```
