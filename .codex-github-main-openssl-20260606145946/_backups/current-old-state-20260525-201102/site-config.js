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
    version: "59",
    label: "v59 warning appeal and ticket repair"
  },

  theme: {
    tokens: {
      "body-bg": "linear-gradient(135deg,#e0ecff,#f8fafc,#e7f6f2)",
      "hero-bg": "radial-gradient(circle at top left,#1d4ed8 0,#020617 45%,#111827 100%)",
      "radius-hero": "28px",
      "radius-section": "22px",
      "radius-card": "20px",
      "radius-control": "14px",
      "blue": "#2563eb",
      "green": "#0f766e",
      "red": "#dc2626",
      "orange": "#f59e0b",
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
