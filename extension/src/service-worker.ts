// MV3 Service Worker
// 현재 MVP에서는 백그라운드 작업이 없으므로 최소 구현
// 향후 알람, 컨텍스트 메뉴, 단축키 등이 필요할 때 확장

self.addEventListener('install', () => {
  // eslint-disable-next-line no-console
  console.log('[moaring] Service worker installed')
})

self.addEventListener('activate', () => {
  // eslint-disable-next-line no-console
  console.log('[moaring] Service worker activated')
})

export {}
