/*
  Item catalog extension file.

  Add avatars, miniroom items, and room backgrounds here.
  app.js will read this file automatically.
*/

window.ECONOMY_CATALOG_EXTENSIONS = {
  avatarItems: {
    // my_avatar: {
    //   id: "my_avatar",
    //   name: "New Avatar",
    //   type: "avatar",
    //   icon: "▣",
    //   price: 300,
    //   rarity: "rare",
    //   src: "assets/avatars/my_avatar.png",
    //   creatorId: "student_id_for_10_percent_revenue"
    // }
  },

  roomItems: {
    // my_lamp: {
    //   id: "my_lamp",
    //   name: "New Lamp",
    //   type: "furniture",
    //   icon: "■",
    //   price: 180,
    //   rarity: "rare",
    //   src: "assets/room/my_lamp.png",
    //   x: 320,
    //   y: 160,
    //   w: 58,
    //   h: 96,
    //   z: 140
    // }
  },

  roomTemplates: {
    // my_room: {
    //   id: "my_room",
    //   name: "New Miniroom Background",
    //   type: "miniroom",
    //   icon: "▣",
    //   price: 1500,
    //   rarity: "epic",
    //   src: "assets/rooms/my_room.png"
    // }
  },

  industry: {
    roles: {
      farmer: {
        id: "farmer",
        name: "농부",
        fee: 10,
        category: "농산물",
        description: "농산물만 생산할 수 있습니다."
      },
      miner: {
        id: "miner",
        name: "광부",
        fee: 10,
        category: "광산물",
        description: "광산물만 생산할 수 있습니다."
      },
      energy: {
        id: "energy",
        name: "발전업자",
        fee: 10,
        category: "화석연료",
        description: "화석연료만 생산할 수 있습니다."
      }
    },
    materials: {
      grain: {
        id: "grain",
        name: "곡물",
        category: "농산물",
        role: "farmer",
        productionCost: 10,
        description: "식품과 생활용품의 기본 재료"
      },
      cotton: {
        id: "cotton",
        name: "목화",
        category: "농산물",
        role: "farmer",
        productionCost: 15,
        description: "옷과 생활용품의 재료"
      },
      ironOre: {
        id: "ironOre",
        name: "철광석",
        category: "광산물",
        role: "miner",
        productionCost: 20,
        description: "도구와 기계의 기본 재료"
      },
      gemstone: {
        id: "gemstone",
        name: "보석원석",
        category: "광산물",
        role: "miner",
        productionCost: 35,
        description: "고급 상품의 재료"
      },
      coal: {
        id: "coal",
        name: "석탄",
        category: "화석연료",
        role: "energy",
        productionCost: 20,
        description: "제품 생산에 필요한 에너지 재료"
      },
      oil: {
        id: "oil",
        name: "석유",
        category: "화석연료",
        role: "energy",
        productionCost: 30,
        description: "플라스틱과 고급 제품의 에너지 재료"
      }
    },
    products: {
      bread: {
        id: "bread",
        name: "빵",
        category: "완제품",
        materials: { grain: 2 },
        manufactureCost: 10,
        description: "농산물을 가공한 기본 식품"
      },
      clothes: {
        id: "clothes",
        name: "옷",
        category: "완제품",
        materials: { cotton: 2, coal: 1 },
        manufactureCost: 15,
        description: "농산물과 에너지를 이용한 생활용품"
      },
      tool: {
        id: "tool",
        name: "도구",
        category: "완제품",
        materials: { ironOre: 2, coal: 1 },
        manufactureCost: 20,
        description: "광산물과 에너지를 이용한 생산 도구"
      },
      plasticToy: {
        id: "plasticToy",
        name: "플라스틱 장난감",
        category: "완제품",
        materials: { oil: 2, cotton: 1 },
        manufactureCost: 20,
        description: "화석연료와 농산물을 이용한 완제품"
      },
      jewelry: {
        id: "jewelry",
        name: "장신구",
        category: "완제품",
        materials: { gemstone: 1, ironOre: 1, coal: 1 },
        manufactureCost: 30,
        description: "광산물을 이용한 고급 완제품"
      }
    }
  }
};
