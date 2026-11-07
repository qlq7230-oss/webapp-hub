// Firebase 콘솔 → 프로젝트 설정 → 일반 → "내 앱"(웹 앱)의 firebaseConfig 값을 붙여 넣으세요.
// 이 값들은 비밀번호가 아니라 "어느 Firebase 프로젝트인지" 알려주는 공개 식별자입니다.
// 데이터 보호는 firestore.rules(보안 규칙)와 Authentication의 '승인된 도메인'이 담당합니다.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
