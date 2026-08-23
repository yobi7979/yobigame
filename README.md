# ⚔️ Survival Roguelike (yobigame)

캔버스 기반 서바이벌 로그라이크. 빌드 과정 없이 `index.html` 단일 파일 게임입니다.

## 플레이
- `index.html` 을 브라우저에서 열기
- 또는: https://yobi7979.github.io/yobigame/ (GitHub Pages)

## 조작
- PC: 이동 WASD, 자동 조준 사격, 스킬 선택 1/2/3, 재시작 R
- 모바일(안드로이드 브라우저): 화면을 누르고 드래그하면 가상 조이스틱이 생성되어 이동, 버튼(시작/재시작/스킬 선택)은 탭으로 사용

## 파일 구성
- `index.html` — 게임 본문 (인라인 스크립트, 터치 컨트롤 포함)
- `game-logic.js` — 코어 게임 로직 (전역)
- `assets/` — 20종 PNG 에셋 (플레이어/적/스킬/배경/타이틀) — 로드 실패 시 절차적 드로잉으로 자동 폴백
