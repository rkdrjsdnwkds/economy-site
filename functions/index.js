const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();

const ROOT = "classEconomy/main";
const MAX_MULTICAST_TOKENS = 500;

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") {
    return Object.entries(value).filter(([, enabled]) => !!enabled).map(([id]) => id);
  }
  return [];
}

function eventMatchesToken(event, tokenRow) {
  if (!tokenRow || tokenRow.enabled === false || !tokenRow.token) return false;
  if (event.audience === "teachers") return tokenRow.role === "teacher";
  if (event.audience === "students") {
    const targets = asArray(event.targetStudentIds);
    return tokenRow.role === "student" && targets.includes(tokenRow.studentId);
  }
  return false;
}

function eventPayload(eventId, event) {
  const title = String(event.title || "경제교실 알림").slice(0, 120);
  const body = String(event.body || "").slice(0, 240);
  return {
    notification: { title, body },
    data: {
      eventId,
      type: String(event.type || ""),
      noticeId: String(event.noticeId || ""),
      roomId: String(event.roomId || ""),
      url: String(event.url || "/"),
      title,
      body
    },
    webpush: {
      fcmOptions: { link: String(event.url || "/") },
      notification: {
        icon: event.icon || "/assets/icons/app-icon-192.png",
        badge: event.badge || "/assets/icons/app-icon-192.png",
        tag: eventId,
        renotify: true
      }
    }
  };
}

exports.sendNotificationEvent = functions.database
  .ref(`/${ROOT}/notificationEvents/{eventId}`)
  .onCreate(async (snapshot, context) => {
    const event = snapshot.val() || {};
    const eventId = context.params.eventId;
    const tokenSnap = await admin.database().ref(`${ROOT}/fcmTokens`).once("value");
    const tokens = [];
    const tokenIds = [];

    tokenSnap.forEach(child => {
      const row = child.val() || {};
      if (eventMatchesToken(event, row)) {
        tokens.push(row.token);
        tokenIds.push(child.key);
      }
    });

    if (!tokens.length) {
      await snapshot.ref.update({
        fcmSentAt: new Date().toISOString(),
        fcmSentCount: 0,
        fcmFailedCount: 0,
        fcmStatus: "no_tokens"
      });
      return null;
    }

    let sentCount = 0;
    let failedCount = 0;
    const invalidTokenIds = [];
    const basePayload = eventPayload(eventId, event);

    for (let i = 0; i < tokens.length; i += MAX_MULTICAST_TOKENS) {
      const tokenChunk = tokens.slice(i, i + MAX_MULTICAST_TOKENS);
      const idChunk = tokenIds.slice(i, i + MAX_MULTICAST_TOKENS);
      const response = await admin.messaging().sendEachForMulticast({
        ...basePayload,
        tokens: tokenChunk
      });
      sentCount += response.successCount;
      failedCount += response.failureCount;
      response.responses.forEach((result, index) => {
        const code = result.error && result.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokenIds.push(idChunk[index]);
        }
      });
    }

    const updates = {
      [`${ROOT}/notificationEvents/${eventId}/fcmSentAt`]: new Date().toISOString(),
      [`${ROOT}/notificationEvents/${eventId}/fcmSentCount`]: sentCount,
      [`${ROOT}/notificationEvents/${eventId}/fcmFailedCount`]: failedCount,
      [`${ROOT}/notificationEvents/${eventId}/fcmStatus`]: failedCount ? "partial" : "sent"
    };
    invalidTokenIds.forEach(id => {
      updates[`${ROOT}/fcmTokens/${id}/enabled`] = false;
      updates[`${ROOT}/fcmTokens/${id}/disabledAt`] = new Date().toISOString();
    });

    await admin.database().ref().update(updates);
    return null;
  });
