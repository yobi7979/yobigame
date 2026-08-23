# ⚔️ Survival Roguelike (yobigane)

캔버스 기반 서바이벌 로그라이크. 빌드 과정 없이 `index.html` 단일 파일 게임입니다.

## 플레이
- `index.html` 을 브라우저에서 열기
- 또는: https://yobi7979.github.io/yobigane/ (GitHub Pages)

## 조작
- 이동: WASD
- 자동 조준 사격 (탄환은 자동으로 가장 가까운 적에게)
- 스킬 선택(레벨업 시): 1 / 2 / 3
- 재시작: R

## 구성
- `index.html` — 게임 본체 (렌더링·UI·인라인 로직)
- `game-logic.js` — 코어 게임 로직 (전역 함수)
- `assets/` — ComfyUI(Z-Image Turbo) 생성 PNG 에셋 20종 (플레이어/적 6종/스킬 아이콘 10종/배경 타일/타이틀 아트). 로드 실패 시 절차적 드로잉으로 자동 폴백

## 테스트
- `game-logic.js` 단위 테스트: `node --test tests/game.test.js` (10/10 통과)
