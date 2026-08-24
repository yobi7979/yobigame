# Survival Roguelike — 그래픽 에셋 디자인 가이드라인

작성자: 메인 에이전트 (2026-08-23)
대상: `D:\vs\헤르메스테스트` 로그라이크 게임(canvas 2D)
프로덕션: Z-Image Turbo (ComfyUI 192.168.201.104:8188) + PIL 백그라운드 컷아웃

---

## 1. 스타일 방향 (모든 에셋 공통)

- **플랫 벡터 2D 게임 스프라이트**: 굵고 명확한 실루엣, 단순 기하학적 디테일, 매트 마감
- **두꺼운 다크 아웃라인** (3px급) → 어두운 배경에서 분리감
- 중앙 정렬, 전신 구성, 고대비
- **순수 검은색(#000) 배경 위 배치** → 포스트 프로세싱에서 경계연결 흑색만 투명 처리(플러드필)
- 텍스트/워터마크/프레임 금지
- 컬러 팔레트는 아래 표를 엄수 (게임 코드에서 이미 사용 중인 색)

| 역할 | 색상 |
|---|---|
| 배경 | #0a0a12 (다크 네이비 블랙) |
| 액센트/골드 | #ffd166 |
| 플레이어 | #ffffff (화이트 + 골드 배지) |
| 적 basic | #e63946 (레드) |
| 적 fast | #7ae582 (그린) |
| 적 tanky | #b197fc (퍼플) |
| 적 ranged | #4dabf7 (블루) |
| 미니보스 | #4ade80 (다크 그린) |
| 보스 | #ff2e63 (크림슨) |
| XP 구슬 | #7ae582 → #ffd166 |
| 불탄 | #ffab2e (오렌지) |

## 2. 에셋 명세 (20종)

| 파일 | 최종 크기(px) | 용도 | 핵심 내용 |
|---|---|---|---|
| player.png | 256 | 플레이어 | 백-골드 갑옷 기사, 라운드 헬멧, 가슴 골드 배지, 단검 |
| enemy_basic.png | 256 | 기본 적 | 작은 레드 고블린 임프, 뾰족 귀, 장난기 있는 표정 |
| enemy_fast.png | 256 | 빠른 적 | 슬릭한 그린 여우, 부시 테일, 점프 자세 |
| enemy_tanky.png | 256 | 중갑 적 | 퍼플 스톤 골렘, 두꺼운 갑옷, 가슴 보석 |
| enemy_ranged.png | 256 | 원거리 적 | 블루 후드 마법사, 빛나는 지팡이, 캐스팅 자세 |
| enemy_miniboss.png | 256 | 스테이지5 보스 | 커다란 그린 데몬, 굽은 뿔, 빛나는 눈 |
| enemy_boss.png | 512 | 스테이지8 보스 | 거대 드래곤 데몬, 큰 날개, 불기운, 중앙 지배 구도 |
| xp_orb.png | 128 | XP 구슬 | 그린-골드 빛 에너볼, 밝은 코어, 방사형 글로우 |
| icon_fireball.png | 128 | 스킬 아이콘 | 오렌지 화염구 + 스파크 |
| icon_chainlightning.png | 128 | 스킬 아이콘 | 전기 블루 재트볼트 지그재그 체인 |
| icon_shield.png | 128 | 스킬 아이콘 | 블루 금속 방패 + 골드 십자 |
| icon_multishot.png | 128 | 스킬 아이콘 | 화이트 실버 도끼 3개 부채꼴 교차 |
| icon_lifesteal.png | 128 | 스킬 아이콘 | 레드 피방울 + 작은 박쥐 실루엣 |
| icon_slowfield.png | 128 | 스킬 아이콘 | 아이시 블루 눈꽃 결정 + 서리 링 |
| icon_split.png | 128 | 스킬 아이콘 | 오렌지 화살 1개 → 3개 분기 |
| icon_spinblade.png | 128 | 스킬 아이콘 | 퍼플 원형 원반 블레이드 |
| icon_explosion.png | 128 | 스킬 아이콘 | 오렌지-옐로 스타버스트 폭발 |
| icon_speed.png | 128 | 스킬 아이콘 | 옐로-그린 바람 대시 스트릭 + 번개 |
| bg_tile.png | 512 | 배경 타일 | 다큐 던전 석재 바닥, 매우 어두운 차콜-블루, 균열/이끼 자국, 저대비, **타일링 가능** |
| title_art.png | 1024x512 | 시작 화면 배너 | 혼자 선 히어로 실루엣 + 거대 빛나는 던전 대문, 골드 광선, 매우 어두운 무드, 텍스트 없음 |

### 아이콘 공통 규격
- **원형 배지**: 다크 슬레이트(#232340급) 원형 배지 + 밝은 골드(#ffd166) 림 + 중앙 글로우 심볼
- 심볼이 배지의 70% 내외를 차지, 배지 전체가 이미지 중앙

## 3. 기술 파이프라인

1. **생성**: Z-Image Turbo, 1024x1024 (bg_tile 512x512, title_art 1024x512), 8 steps, res_multistep/simple, AuraFlow shift 3, CFG 1(무시), 랜덤 정수 시드
2. **프롬프트**: 영어로 길고 구조화된 자연어 (주체 외형→자세→색상→조명→스타일 태그). 공통 스타일 서픽스:
   `flat vector 2D game sprite, clean bold silhouette, simple geometric design, matte finish, subtle soft shading, thick dark outline, centered full body, isolated on pure solid black background, no text, no watermark, no frame, high contrast`
3. **컷아웃**: `generate.py` 내 플러드필(경계에 연결된 ≤24 명도 픽셀만 제거) → 가우시안 블러 1.0 → 알파. 내부의 검은 아웃라인은 보존됨
4. **리사이즈**: LANCZOS로 최종 크기, `assets/<name>.png` 저장. 원본은 `assets/raw/` 보관
5. **로그**: `assets/results.json`에 {name, seed, status, error} 기록. 완료된 파일은 재실행 시 스킵(재개 가능)

## 4. 검수 기준 (메인 에이전트 최종 확인)

- [ ] 파일 20종 전부 존재, PNG, 최종 크기와 일치
- [ ] 실루엣이 40px 축소에서도 식별 가능 (형/적 구분)
- [ ] 팔레트 색상 충실 (테이블 대조)
- [ ] 스타일 통일 (20장이 한 게임 세트처럼 보임)
- [ ] 백그라운드 잔여/블랙 박스/티어링 없음
- [ ] 텍스트·워터마크·안면 왜곡·손가락 뒤틀림 없음
- [ ] bg_tile: 2x2 반복 시 seams 눈에 띄지 않음
- [ ] title_art: 시작 화면에 걸어도 시야를 방해하지 않는 어둠 레벨
