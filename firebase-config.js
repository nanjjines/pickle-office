// Firebase 프로젝트: pickle-office (Spark 무료 플랜)
// 웹 앱: pickle-office-web — 이 설정 값은 공개되어도 되는 클라이언트 키입니다.
// 접근 범위는 Realtime Database 보안 규칙으로만 제한됩니다.
//  · 익명 로그인(Anonymous Auth) 세션 + access/sessions/{uid}에 묶인 유효한 초대 코드가 없으면
//    office 노드의 읽기/쓰기 자체가 Permission denied가 됩니다. 코드는 access/codes에만 있고
//    클라이언트는 읽을 수 없습니다.
export const firebaseConfig = {
  apiKey: 'AIzaSyDgYZwxvQh6raI2xJKD41jUrfHBcTcFQMY',
  authDomain: 'pickle-office-ab18d.firebaseapp.com',
  databaseURL: 'https://pickle-office-ab18d-default-rtdb.firebaseio.com',
  projectId: 'pickle-office-ab18d',
  storageBucket: 'pickle-office-ab18d.firebasestorage.app',
  messagingSenderId: '1084748938165',
  appId: '1:1084748938165:web:7bb892ae891128b6a9b7fc',
};
