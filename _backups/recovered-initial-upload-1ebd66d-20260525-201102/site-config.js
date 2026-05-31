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
    version: "128",
    label: "v128 mobile bottom nav alignment fix"
  },

  theme: {
    tokens: {
      "body-bg": "linear-gradient(180deg,#ffffff 0%,#f7f9f6 100%)",
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

  featureFlags: {
    devMode: true
  }
};
