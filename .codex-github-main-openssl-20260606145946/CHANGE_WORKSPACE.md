# 변경 작업대 가이드

오늘처럼 디자인, 공식, UX, 아이템을 크게 바꿀 때는 아래 순서로 작업하세요.

## 자주 고치는 파일

- `site-config.js`: 디자인 색상, 둥근 정도, 티켓 공식, UX 기본값
- `catalog.js`: 아바타, 미니룸 가구, 미니룸 배경
- `styles.css`: 화면 배치와 컴포넌트 스타일
- `app.js`: 실제 기능, 화면 렌더링, Firebase 동작

## 실행

```bash
npm run serve
```

PowerShell에서 `npm` 실행 정책 오류가 나면 아래처럼 실행합니다.

```bash
npm.cmd run serve
```

또는 Windows에서 `run-local-server.bat`를 더블클릭합니다.

## 검증

```bash
npm run check
```

PowerShell에서 `npm` 실행 정책 오류가 나면 아래처럼 실행합니다.

```bash
npm.cmd run check
```

검증은 다음을 확인합니다.

- 주요 JavaScript 파일 문법
- `site-config.js`와 `catalog.js`가 정상 로드되는지
- 아이템 정의가 객체 형태인지

## 변경 원칙

1. 숫자 조정은 먼저 `site-config.js`에서 합니다.
2. 새 아이템 추가는 먼저 `catalog.js`에서 합니다.
3. 화면 구조가 바뀔 때만 `app.js`를 수정합니다.
4. 수정 후에는 `npm run check`를 먼저 실행합니다.

## 빠른 위치표

- 티켓 가격 공식: `site-config.js`의 `formulas.tickets`
- 기본 학생 화면 탭: `site-config.js`의 `ux.defaultStudentTab`
- 구매 확인창 켜기/끄기: `site-config.js`의 `ux.requirePurchaseConfirm`
- 대표 색상: `site-config.js`의 `theme.tokens`
- 새 아바타: `catalog.js`의 `avatarItems`
- 새 미니룸 가구: `catalog.js`의 `roomItems`
