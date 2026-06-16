/*
  Change hub for economy-site.

  Use this file for frequent tuning:
  - design tokens and layout radius
  - economy formulas
  - small UX defaults

  Keep app.js for behavior changes, catalog.js for item changes.
*/

window.ECONOMY_SITE_CONFIG = {
  meta: {
    version: "176",
    label: "v176 AI question bridge"
  },

  theme: {
    tokens: {
      "body-bg": "#f4f7fb",
      "hero-bg": "linear-gradient(135deg,#4d8c3e 0%,#2f6d36 100%)",
      "radius-hero": "24px",
      "radius-section": "22px",
      "radius-card": "22px",
      "radius-control": "16px",
      "blue": "#4f87ff",
      "green": "#4c8f3a",
      "red": "#dc2626",
      "orange": "#ff6a1a",
      "purple": "#7c3aed"
    }
  },

  formulas: {
    tickets: {
      baseMultipliers: {
        classClean: 1,
        personalClean: 0.2,
        playHour: 3,
        default: 1
      },
      buyPressure: 1,
      sellBaseRatio: 0.3,
      sellPressure: 1.2
    }
  },

  ux: {
    defaultMode: "student",
    defaultStudentTab: "dashboard",
    firebaseDelayWarningMs: 5000,
    toastMs: 2600,
    requirePurchaseConfirm: true
  },

  notifications: {
    // Firebase Console > Project settings > Cloud Messaging > Web Push certificates
    // 이 공개키를 넣어야 앱이 완전히 닫혀 있어도 FCM 푸시를 받을 수 있습니다.
    webPushVapidKey: "BJX5ynQQjfOTXrvdlT4T0yHkBmN9iUtR8zlRjyAT3WF8OnZ9myjQkwb0WIJEh35aR4t7gDK-P6wjn0KD-S2JPmk"
  },

  featureFlags: {
    devMode: true
  }
};
