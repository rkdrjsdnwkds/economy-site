/**
 * 경제교실 AI 질문함 - Custom GPT Action용 Google Apps Script 웹앱
 *
 * 배포:
 * 1. script.google.com 새 프로젝트 생성
 * 2. 이 파일 전체 붙여넣기
 * 3. FIREBASE_DATABASE_URL 확인
 * 4. 배포 > 새 배포 > 웹 앱
 *    - 실행: 나
 *    - 액세스 권한: 링크가 있는 모든 사용자 또는 조직 내 사용자
 * 5. 배포 URL을 Custom GPT Action OpenAPI 서버 URL에 넣기
 *
 * 보안 메모:
 * Apps Script doPost는 임의 HTTP 헤더를 안정적으로 읽기 어렵기 때문에,
 * 첫 테스트는 BRIDGE_TOKEN을 빈 문자열로 두고 진행할 수 있습니다.
 * 실제 운영에서는 Script Properties에 BRIDGE_TOKEN을 저장하고,
 * Custom GPT 요청 body에 같은 bridgeToken을 포함시키는 방식으로 제한하세요.
 */

const FIREBASE_DATABASE_URL = 'https://economy-44982-default-rtdb.firebaseio.com';
const FIREBASE_BASE_PATH = 'classEconomy/main';
const DOCUMENT_FOLDER_ID = ''; // 선택: AI 답변 문서를 넣을 Drive 폴더 ID. 비워두면 내 드라이브 루트에 생성됩니다.
const REQUIRE_TOKEN = false; // 실제 운영 시 true 권장

function doPost(e) {
  try {
    const payload = parseJson_(e);
    assertToken_(payload);
    const action = String(payload.action || '').trim();

    if (action === 'health') return json_({ ok: true, service: 'economy-ai-question-bridge' });
    if (action === 'getNextQuestion') return json_(getNextQuestion_());
    if (action === 'saveAnswer') return json_(saveAnswer_(payload));
    if (action === 'markNeedsTeacherReview') return json_(markNeedsTeacherReview_(payload));

    return json_({ ok: false, error: 'UNKNOWN_ACTION', message: '지원하지 않는 action입니다.' });
  } catch (err) {
    return json_({ ok: false, error: 'SERVER_ERROR', message: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'economy-ai-question-bridge', hint: 'POST로 action을 보내세요.' });
}

function parseJson_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function assertToken_(payload) {
  if (!REQUIRE_TOKEN) return;
  const expected = String(PropertiesService.getScriptProperties().getProperty('BRIDGE_TOKEN') || '');
  if (!expected) throw new Error('BRIDGE_TOKEN이 Script Properties에 없습니다.');
  const actual = String(payload.bridgeToken || '');
  if (actual !== expected) throw new Error('Bridge token mismatch');
}

function firebaseUrl_(path) {
  const cleanPath = [FIREBASE_BASE_PATH, path].filter(Boolean).join('/').replace(/\/+/g, '/');
  return FIREBASE_DATABASE_URL.replace(/\/$/, '') + '/' + cleanPath + '.json';
}

function fbGet_(path) {
  const res = UrlFetchApp.fetch(firebaseUrl_(path), { method: 'get', muteHttpExceptions: true });
  return JSON.parse(res.getContentText() || 'null');
}

function fbPatch_(path, data) {
  const res = UrlFetchApp.fetch(firebaseUrl_(path), {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Firebase patch failed: ' + code + ' ' + res.getContentText());
  return JSON.parse(res.getContentText() || 'null');
}

function fbPut_(path, data) {
  const res = UrlFetchApp.fetch(firebaseUrl_(path), {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Firebase put failed: ' + code + ' ' + res.getContentText());
  return JSON.parse(res.getContentText() || 'null');
}

function nowIso_() {
  return new Date().toISOString();
}

function nextId_(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function asList_(map) {
  return Object.keys(map || {}).map(function (id) {
    const value = map[id] || {};
    value.id = value.id || id;
    return value;
  });
}

function getNextQuestion_() {
  const requests = asList_(fbGet_('aiQuestionRequests'))
    .filter(function (r) { return (r.status || 'waiting') === 'waiting'; })
    .sort(function (a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); });

  if (!requests.length) return { ok: true, hasQuestion: false, message: '대기 질문이 없습니다.' };

  const req = requests[0];
  fbPatch_('aiQuestionRequests/' + req.id, {
    status: 'processing',
    processingStartedAt: nowIso_(),
    updatedAt: nowIso_()
  });

  return {
    ok: true,
    hasQuestion: true,
    requestId: req.id,
    studentId: req.studentId || '',
    studentName: req.studentName || '',
    mode: req.mode || 'concept',
    question: req.question || '',
    createdAt: req.createdAt || ''
  };
}

function saveAnswer_(payload) {
  const requestId = String(payload.requestId || '').trim();
  const studentId = String(payload.studentId || '').trim();
  const studentName = String(payload.studentName || '').trim();
  const question = String(payload.question || '').trim();
  const answer = String(payload.answer || '').trim();

  if (!requestId) throw new Error('requestId가 필요합니다.');
  if (!studentId) throw new Error('studentId가 필요합니다.');
  if (!answer) throw new Error('answer가 필요합니다.');

  const doc = DocumentApp.create('AI 답변 - ' + (studentName || studentId) + ' - ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm'));
  const body = doc.getBody();
  body.appendParagraph('경제교실 AI 답변').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('학생: ' + (studentName || studentId));
  body.appendParagraph('생성 시각: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
  body.appendParagraph('');
  body.appendParagraph('학생 질문').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(question || '(질문 내용 없음)');
  body.appendParagraph('');
  body.appendParagraph('AI 답변').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  answer.split('\n').forEach(function (line) { body.appendParagraph(line); });
  body.appendParagraph('');
  body.appendParagraph('※ 이 답변은 AI가 생성했으며, 수업에서는 선생님 안내를 우선합니다.').setItalic(true);
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  if (DOCUMENT_FOLDER_ID) {
    const folder = DriveApp.getFolderById(DOCUMENT_FOLDER_ID);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const documentUrl = doc.getUrl();

  const now = nowIso_();
  const preview = answer.replace(/\s+/g, ' ').slice(0, 140);
  const roomId = 'room_' + studentId;
  const msgId = nextId_('tx');
  const messageText = '🤖 AI 답변 문서가 도착했습니다.\n' + documentUrl;
  const room = fbGet_('teacherMessageRooms/' + roomId) || {};

  const updates = {};
  updates['aiQuestionRequests/' + requestId + '/status'] = 'completed';
  updates['aiQuestionRequests/' + requestId + '/documentUrl'] = documentUrl;
  updates['aiQuestionRequests/' + requestId + '/answerPreview'] = preview;
  updates['aiQuestionRequests/' + requestId + '/answeredAt'] = now;
  updates['aiQuestionRequests/' + requestId + '/updatedAt'] = now;
  updates['teacherMessages/' + msgId] = {
    id: msgId,
    roomId: roomId,
    senderId: 'teacher',
    senderName: '선생님 AI 답변',
    senderRole: 'teacher',
    text: messageText,
    createdAt: now,
    readByTeacher: true,
    readByStudent: false,
    deleted: false,
    aiRequestId: requestId,
    documentUrl: documentUrl
  };
  updates['teacherMessageRooms/' + roomId + '/id'] = roomId;
  updates['teacherMessageRooms/' + roomId + '/studentId'] = studentId;
  updates['teacherMessageRooms/' + roomId + '/studentName'] = studentName || studentId;
  updates['teacherMessageRooms/' + roomId + '/teacherId'] = 'teacher';
  updates['teacherMessageRooms/' + roomId + '/lastMessage'] = messageText;
  updates['teacherMessageRooms/' + roomId + '/lastMessageAt'] = now;
  updates['teacherMessageRooms/' + roomId + '/lastSenderRole'] = 'teacher';
  updates['teacherMessageRooms/' + roomId + '/unreadByStudent'] = Number(room.unreadByStudent || 0) + 1;
  updates['teacherMessageRooms/' + roomId + '/unreadByTeacher'] = 0;
  updates['teacherMessageRooms/' + roomId + '/updatedAt'] = now;
  updates['teacherMessageRooms/' + roomId + '/closed'] = false;

  fbPatch_('', updates);

  return { ok: true, requestId: requestId, documentUrl: documentUrl, messageId: msgId };
}

function markNeedsTeacherReview_(payload) {
  const requestId = String(payload.requestId || '').trim();
  if (!requestId) throw new Error('requestId가 필요합니다.');
  const reason = String(payload.reason || '교사 직접 검토 필요').slice(0, 300);
  fbPatch_('aiQuestionRequests/' + requestId, {
    status: 'review',
    reviewReason: reason,
    updatedAt: nowIso_()
  });
  return { ok: true, requestId: requestId, status: 'review' };
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
