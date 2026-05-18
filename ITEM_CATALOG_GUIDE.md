# 아바타/미니룸 아이템 추가 가이드

아이템을 추가할 때는 `app.js`를 직접 수정하지 말고 `catalog.js`만 수정하세요.

## 아바타 추가

1. 이미지 파일을 `assets/avatars/`에 넣습니다.
2. `catalog.js`의 `avatarItems` 안에 예시를 복사해 붙입니다.
3. `id`, `name`, `src`, `price`, `rarity`를 바꿉니다.

```js
new_avatar: {
  id: "new_avatar",
  name: "새 아바타",
  type: "avatar",
  icon: "▣",
  price: 300,
  rarity: "희귀",
  src: "assets/avatars/new_avatar.png"
}
```

## 미니룸 아이템 추가

1. 이미지 파일을 `assets/room/`에 넣습니다.
2. `catalog.js`의 `roomItems` 안에 예시를 복사해 붙입니다.
3. `x`, `y`, `w`, `h`, `z`로 미니룸 안 위치와 크기를 조정합니다.

```js
new_chair: {
  id: "new_chair",
  name: "새 의자",
  type: "furniture",
  icon: "■",
  price: 180,
  rarity: "희귀",
  src: "assets/room/new_chair.png",
  x: 280,
  y: 185,
  w: 72,
  h: 90,
  z: 170
}
```

## 위치값 기준

- `x`: 왼쪽에서 떨어진 거리
- `y`: 위쪽에서 떨어진 거리
- `w`: 아이템 너비
- `h`: 아이템 높이
- `z`: 겹침 순서. 숫자가 클수록 앞에 보입니다.

## 정렬 순서

기본 아이템 뒤에 새 아이템이 자동으로 붙습니다. 순서를 더 세밀하게 조정하려면 아이템에 `order` 값을 넣으세요.

```js
order: 10
```
