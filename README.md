# 웹앱 허브

직접 만든 웹앱을 모아 GitHub Pages로 배포하는 저장소입니다.

| 앱 | 경로 | 백엔드 |
|---|---|---|
| 나의 일기장 | `/diary/` | Firebase (Firestore + Google 로그인) |

## 구성

```
index.html            허브 첫 화면
diary/
  index.html          일기장 화면
  app.js              로그인·저장 로직
  style.css           디자인
  firebase-config.js  Firebase 프로젝트 연결 정보 (공개 식별자)
firestore.rules       Firestore 보안 규칙 (본인 일기만 읽기/쓰기)
firebase.json         Firebase CLI로 규칙을 배포할 때 사용
SECURITY.md           보안·개인정보 점검 결과
```

## Firebase 설정 순서 (처음 한 번)

1. https://console.firebase.google.com 에서 **프로젝트 추가** (Google 애널리틱스는 꺼도 됩니다)
2. **빌드 → Authentication → 시작하기 → 로그인 방법 → Google** 사용 설정
3. **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)` 권장, **프로덕션 모드**로 시작
4. Firestore → **규칙** 탭에 `firestore.rules` 내용을 그대로 붙여 넣고 **게시**
5. **프로젝트 설정 → 일반 → 내 앱 → 웹(</>)** 앱 추가 → 나오는 `firebaseConfig` 값을 `diary/firebase-config.js`에 붙여 넣기
6. **Authentication → 설정 → 승인된 도메인**에 `<GitHub 아이디>.github.io` 추가

## GitHub Pages 배포

저장소 **Settings → Pages → Build and deployment**에서
Source: `Deploy from a branch`, Branch: `main` / `/ (root)` → Save.
몇 분 뒤 `https://<GitHub 아이디>.github.io/<저장소 이름>/` 에서 열립니다.

## 새 앱 추가하기

1. 새 폴더(예: `timer/`)를 만들고 그 안에 `index.html`을 둡니다.
2. 허브 `index.html`의 카드 목록에 링크를 하나 추가합니다.

## 문제 해결

- **로그인 창이 안 뜸**: 브라우저 팝업 차단 해제
- **auth/unauthorized-domain**: 위 6번(승인된 도메인) 확인
- **permission-denied**: 4번 규칙이 게시되었는지 확인
- **화면이 하얗게 멈춤**: 브라우저 개발자 도구(F12) 콘솔에 Content-Security-Policy 오류가 보이면 `diary/index.html`의 CSP `<meta>` 줄을 알려 주세요.
