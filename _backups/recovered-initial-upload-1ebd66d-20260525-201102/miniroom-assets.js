function pixelRoomDataUrl(wall="#ead9b4", wallShade="#d8bd85", floor="#d3a66d"){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" shape-rendering="crispEdges">
    <rect width="240" height="180" fill="#f1dea3"/>
    <path d="M82 146h112l35 15H116z" fill="#9b7a3d" opacity=".28"/>
    <path d="M42 36l78-22v65l-78 22z" fill="${wall}" stroke="#3a2517" stroke-width="5"/>
    <path d="M120 14l78 22v65l-78-22z" fill="${wallShade}" stroke="#3a2517" stroke-width="5"/>
    <path d="M48 85l72-19 72 19v10l-72-20-72 20z" fill="#fff8df"/>
    <path d="M120 14v65" stroke="#5a3a21" stroke-width="5"/>
    <path d="M42 101l78-22 78 22-78 68z" fill="${floor}" stroke="#3a2517" stroke-width="5"/>
    <path d="M60 108l60-16 60 16M78 122l42-14 42 14M96 138l24-10 24 10M120 79v90M72 110l96 40M168 110l-96 40" stroke="#f4d29a" stroke-width="2"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export const MINIROOM_TEMPLATES = {
  room_wood_study: {
    id: "room_wood_study",
    name: "따뜻한 공부방",
    type: "miniroom",
    icon: "▣",
    price: 2000,
    rarity: "에픽",
    src: pixelRoomDataUrl()
  }
};
