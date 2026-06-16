import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtwpc4THHE_t3fSfV-FgS4KHF2krUosvA",
  authDomain: "economy-44982.firebaseapp.com",
  databaseURL: "https://economy-44982-default-rtdb.firebaseio.com",
  projectId: "economy-44982",
  storageBucket: "economy-44982.firebasestorage.app",
  messagingSenderId: "979007941269",
  appId: "1:979007941269:web:140c0a114b64ffecd1899c",
  measurementId: "G-ZC0FVSV9JL"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const rootPath = "classEconomy/main";
const rootRef = ref(db, rootPath);
const REQUEST_PATH = "aiQuestionRequests";
const SETTINGS_PATH = "aiBridgeSettings";
const GPT_DEFAULT_URL = "https://chatgpt.com/";
const MAX_QUESTION_LENGTH = 500;
const DAILY_LIMIT = 5;
const ACTIVE_LIMIT = 2;

const state = {
  data: {},
  ready: false,
  teacherTabActive: false,
  studentPanelMountedFor: "",
  lastRenderKey: ""
};

function obj(value){ return value && typeof value === "object" ? value : {}; }
function arr(value){ return Object.values(obj(value)); }
function nowIso(){ return new Date().toISOString(); }
function todayKey(){ return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function id(prefix="aiq"){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function escapeHtml(text=""){
  return String(text).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function oneLine(text="", limit=90){
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}
function studentName(studentId){
  return obj(state.data.students)[studentId]?.name || studentId || "학생";
}
function selectedStudentId(){ return localStorage.getItem("selectedStudent") || ""; }
function statusText(status){
  return ({
    waiting: "대기",
    processing: "GPT 처리중",
    completed: "완료",
    review: "교사 검토",
    rejected: "반려",
    failed: "실패"
  })[status] || status || "대기";
}
function statusClass(status){
  return ({completed:"green", processing:"blue", review:"orange", rejected:"red", failed:"red", waiting:"gray"})[status] || "gray";
}
function requestRows(){
  return arr(state.data[REQUEST_PATH]).filter(r => r && r.id).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
function waitingRows(){ return requestRows().filter(r => (r.status || "waiting") === "waiting"); }
function activeRowsForStudent(studentId){
  return requestRows().filter(r => r.studentId === studentId && ["waiting", "processing"].includes(r.status || "waiting"));
}
function todayRowsForStudent(studentId){
  const day = todayKey();
  return requestRows().filter(r => r.studentId === studentId && String(r.createdAt || "").slice(0, 10) === day);
}
function settings(){ return obj(state.data[SETTINGS_PATH]); }
function gptUrl(){ return String(settings().customGptUrl || localStorage.getItem("aiBridgeCustomGptUrl") || GPT_DEFAULT_URL).trim() || GPT_DEFAULT_URL; }
function toast(message){
  if(typeof window.toast === "function") return window.toast(message);
  const old = document.querySelector(".aiBridgeToast");
  if(old) old.remove();
  const el = document.createElement("div");
  el.className = "aiBridgeToast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast("복사했습니다.");
  }catch(_){
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast("복사했습니다.");
  }
}
function dbPath(path=""){ return path ? `${rootPath}/${path}` : rootPath; }
async function dbUpdate(path, value){ return update(ref(db, dbPath(path)), value); }
async function dbSet(path, value){ return set(ref(db, dbPath(path)), value); }

function injectStyles(){
  if(document.getElementById("aiBridgeStyles")) return;
  const style = document.createElement("style");
  style.id = "aiBridgeStyles";
  style.textContent = `
    .aiBridgeToast{position:fixed;left:50%;bottom:24px;z-index:99999;transform:translateX(-50%);background:#111827;color:white;padding:12px 16px;border-radius:999px;box-shadow:0 12px 30px rgba(15,23,42,.22);font-weight:800}
    .aiBridgePanel{border:1px solid rgba(76,143,58,.18);background:linear-gradient(180deg,#ffffff 0%,#f7fbf4 100%);border-radius:22px;padding:18px;margin:16px 0;box-shadow:0 14px 36px rgba(15,23,42,.08)}
    .aiBridgeHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.aiBridgeHead h2,.aiBridgeHead h3{margin:0}.aiBridgeHead p{margin:4px 0 0;color:#64748b;font-size:13px}.aiBridgeBadge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:5px 9px;background:#e2e8f0;color:#334155;font-size:12px;font-weight:900}.aiBridgeBadge.green{background:#dcfce7;color:#166534}.aiBridgeBadge.blue{background:#dbeafe;color:#1d4ed8}.aiBridgeBadge.orange{background:#ffedd5;color:#c2410c}.aiBridgeBadge.red{background:#fee2e2;color:#b91c1c}.aiBridgeBadge.gray{background:#f1f5f9;color:#475569}
    .aiBridgeComposer{display:grid;gap:10px}.aiBridgeComposer textarea{width:100%;min-height:104px;border:1px solid #cbd5e1;border-radius:16px;padding:12px;font:inherit;resize:vertical;background:white}.aiBridgeComposer select,.aiBridgeInput{border:1px solid #cbd5e1;border-radius:14px;padding:10px 12px;font:inherit;background:white}.aiBridgeToolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.aiBridgeToolbar button,.aiBridgeBtn{border:0;border-radius:14px;padding:10px 13px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#0f172a}.aiBridgeToolbar button.primary,.aiBridgeBtn.primary{background:#4c8f3a;color:white}.aiBridgeToolbar button.blue,.aiBridgeBtn.blue{background:#2563eb;color:white}.aiBridgeToolbar button.green,.aiBridgeBtn.green{background:#16a34a;color:white}.aiBridgeToolbar button.orange,.aiBridgeBtn.orange{background:#f97316;color:white}.aiBridgeToolbar button.red,.aiBridgeBtn.red{background:#dc2626;color:white}.aiBridgeToolbar button:disabled,.aiBridgeBtn:disabled{opacity:.45;cursor:not-allowed}.aiBridgeSmall{font-size:12px;color:#64748b;line-height:1.5}.aiBridgeList{display:grid;gap:10px;margin-top:12px}.aiBridgeCard{border:1px solid #e2e8f0;background:white;border-radius:18px;padding:13px}.aiBridgeCardTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.aiBridgeQuestion{font-weight:900;color:#0f172a}.aiBridgeMeta{font-size:12px;color:#64748b;margin-top:4px}.aiBridgeAnswerLink{display:inline-flex;margin-top:10px;padding:8px 10px;border-radius:12px;background:#eef6ff;color:#1d4ed8;font-weight:900;text-decoration:none}.aiBridgeTeacherGrid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px}.aiBridgeQueue{display:grid;gap:10px}.aiBridgeSettings{display:grid;gap:10px}.aiBridgeEmpty{border:1px dashed #cbd5e1;border-radius:18px;padding:18px;text-align:center;color:#64748b;background:#f8fafc}.aiBridgeCount{font-size:28px;font-weight:1000;color:#14532d}.aiBridgeCopyBox{white-space:pre-wrap;background:#0f172a;color:#e2e8f0;border-radius:16px;padding:12px;font-size:12px;line-height:1.55;max-height:190px;overflow:auto}.aiBridgeStudentHistory{margin-top:18px}.aiBridgeRejectBox{display:flex;gap:8px;margin-top:10px}.aiBridgeRejectBox input{flex:1}.aiBridgeDocPreview{margin-top:8px;padding:9px;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.45}@media(max-width:760px){.aiBridgeTeacherGrid{grid-template-columns:1fr}.aiBridgeHead{display:block}.aiBridgeToolbar{align-items:stretch}.aiBridgeToolbar button,.aiBridgeBtn{flex:1}.aiBridgePanel{border-radius:18px;padding:14px}}
  `;
  document.head.appendChild(style);
}

function currentGptInstruction(){
  return `다음 질문 처리해.\n\n규칙:\n1. getNextQuestion 액션으로 경제교실의 가장 오래된 대기 질문을 가져와.\n2. 개인정보, 상담, 건강, 가정사, 폭력, 위험 행동, 비밀번호/연락처가 있으면 답하지 말고 markNeedsTeacherReview 액션으로 넘겨.\n3. 일반 학습 질문이면 초등학교 5학년 수준으로 짧고 친절하게 답해.\n4. 정답만 주지 말고 개념 설명 → 예시 → 다시 생각해 볼 질문 순서로 답해.\n5. 답변을 만든 뒤 saveAnswer 액션을 호출해서 Google 문서 생성과 경제교실 메신저 등록까지 완료해.\n6. 마지막에는 선생님에게 처리 결과와 문서 링크만 짧게 보고해.`;
}
function directPromptForRequest(req){
  return `다음 학생 질문에 초등학교 5학년 수준으로 답해.\n답변은 개념 설명 → 예시 → 다시 생각해 볼 질문 순서로 작성해.\n답변 생성 후 saveAnswer 액션을 호출해 Google 문서와 경제교실 메신저 링크를 저장해.\n\nrequestId: ${req.id}\nstudentId: ${req.studentId}\nstudentName: ${req.studentName || studentName(req.studentId)}\nmode: ${req.mode || "concept"}\n\n학생 질문:\n${req.question}`;
}
function actionSetupHint(){
  return `Custom GPT Actions 설정이 끝나 있으면, GPT에게 아래 한 문장만 보내도 됩니다.\n\n${currentGptInstruction()}`;
}

function ensureTeacherTab(){
  injectStyles();
  const tabs = document.getElementById("teacherTabs");
  const teacherView = document.getElementById("teacherView");
  if(!tabs || !teacherView) return;
  if(!document.getElementById("aiBridgeTeacherTabButton")){
    const btn = document.createElement("button");
    btn.id = "aiBridgeTeacherTabButton";
    btn.type = "button";
    btn.dataset.tab = "aiQuestions";
    btn.textContent = `AI 질문함`;
    btn.addEventListener("click", () => window.aiBridgeOpenTeacherTab());
    tabs.insertBefore(btn, tabs.querySelector('[data-tab="ledger"]') || tabs.lastElementChild);
    tabs.addEventListener("click", event => {
      if(event.target?.id !== "aiBridgeTeacherTabButton") state.teacherTabActive = false;
    });
  }
  if(!document.getElementById("aiQuestions")){
    const section = document.createElement("section");
    section.id = "aiQuestions";
    section.className = "tabPage hidden";
    teacherView.appendChild(section);
  }
  updateTeacherTabBadge();
}
function updateTeacherTabBadge(){
  const btn = document.getElementById("aiBridgeTeacherTabButton");
  if(!btn) return;
  const count = waitingRows().length;
  btn.textContent = count ? `AI 질문함 (${count})` : "AI 질문함";
}
window.aiBridgeOpenTeacherTab = function(){
  state.teacherTabActive = true;
  ensureTeacherTab();
  document.querySelectorAll("#teacherTabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById("aiBridgeTeacherTabButton")?.classList.add("active");
  document.querySelectorAll("#teacherView .tabPage").forEach(section => section.classList.add("hidden"));
  document.getElementById("aiQuestions")?.classList.remove("hidden");
  renderTeacherPanel();
};

function renderTeacherPanel(){
  const panel = document.getElementById("aiQuestions");
  if(!panel) return;
  const rows = requestRows();
  const waiting = waitingRows();
  const processing = rows.filter(r => r.status === "processing");
  const review = rows.filter(r => r.status === "review");
  const recent = rows.slice(0, 12);
  const gpt = gptUrl();
  panel.innerHTML = `<div class="aiBridgePanel">
    <div class="aiBridgeHead">
      <div><h2>AI 질문함</h2><p>학생 질문을 Custom GPT Action으로 가져가고, 답변 문서 링크를 경제교실 메신저에 되돌려 받는 중계 화면입니다.</p></div>
      <div class="aiBridgeToolbar"><span class="aiBridgeBadge green">대기 ${waiting.length}</span><span class="aiBridgeBadge blue">처리중 ${processing.length}</span><span class="aiBridgeBadge orange">검토 ${review.length}</span></div>
    </div>
    <div class="aiBridgeTeacherGrid">
      <div>
        <div class="aiBridgeCard">
          <div class="aiBridgeCardTop"><div><h3>1번 자동화: GPT가 직접 대기 질문 가져오기</h3><div class="aiBridgeMeta">교사는 질문을 복사하지 않고 Custom GPT에 처리 명령만 보냅니다.</div></div><div class="aiBridgeCount">${waiting.length}</div></div>
          <div class="aiBridgeToolbar" style="margin-top:12px">
            <button class="primary" onclick="aiBridgeCopyNextInstruction()">처리 명령 복사</button>
            <button class="blue" onclick="aiBridgeOpenGpt()">Custom GPT 열기</button>
            <button onclick="aiBridgeCopySetupHint()">설정 힌트 복사</button>
          </div>
          <div class="aiBridgeCopyBox" style="margin-top:12px">${escapeHtml(currentGptInstruction())}</div>
        </div>
        <div class="aiBridgeList">
          ${waiting.length ? waiting.slice(0, 8).map(teacherQueueCardHtml).join("") : `<div class="aiBridgeEmpty">대기 중인 AI 질문이 없습니다.</div>`}
        </div>
      </div>
      <div>
        <div class="aiBridgeCard aiBridgeSettings">
          <h3>연결 설정</h3>
          <label class="aiBridgeSmall"><b>Custom GPT 주소</b><br><input class="aiBridgeInput" id="aiBridgeGptUrl" value="${escapeHtml(gpt)}" placeholder="https://chatgpt.com/g/..." style="width:100%;margin-top:6px"></label>
          <div class="aiBridgeToolbar"><button class="green" onclick="aiBridgeSaveGptUrl()">주소 저장</button><button onclick="aiBridgeOpenGpt()">열기</button></div>
          <p class="aiBridgeSmall">Apps Script URL과 Bridge Token은 경제교실 DB에 저장하지 않는 것을 권장합니다. Custom GPT Action 설정 또는 Apps Script Script Properties 쪽에서 관리하세요.</p>
        </div>
        <div class="aiBridgeCard">
          <h3>최근 처리 기록</h3>
          <div class="aiBridgeList">${recent.length ? recent.map(teacherRecentCardHtml).join("") : `<p class="aiBridgeSmall">기록이 없습니다.</p>`}</div>
        </div>
      </div>
    </div>
  </div>`;
}
function teacherQueueCardHtml(req){
  return `<div class="aiBridgeCard">
    <div class="aiBridgeCardTop"><div><div class="aiBridgeQuestion">${escapeHtml(req.studentName || studentName(req.studentId))}</div><div class="aiBridgeMeta">${escapeHtml(req.createdAt || "")} · ${escapeHtml(req.mode || "concept")}</div></div><span class="aiBridgeBadge ${statusClass(req.status)}">${statusText(req.status)}</span></div>
    <p class="aiBridgeDocPreview">${escapeHtml(req.question || "")}</p>
    <div class="aiBridgeToolbar"><button class="primary" onclick="aiBridgeCopyDirectPrompt('${req.id}')">이 질문 직접 프롬프트 복사</button><button class="orange" onclick="aiBridgeMarkReview('${req.id}')">검토로 넘김</button><button class="red" onclick="aiBridgeRejectRequest('${req.id}')">반려</button></div>
  </div>`;
}
function teacherRecentCardHtml(req){
  const link = req.documentUrl ? `<a class="aiBridgeAnswerLink" href="${escapeHtml(req.documentUrl)}" target="_blank" rel="noopener">문서 열기</a>` : "";
  return `<div class="aiBridgeCard"><div class="aiBridgeCardTop"><b>${escapeHtml(req.studentName || studentName(req.studentId))}</b><span class="aiBridgeBadge ${statusClass(req.status)}">${statusText(req.status)}</span></div><div class="aiBridgeMeta">${escapeHtml(oneLine(req.question, 60))}</div>${link}</div>`;
}
window.aiBridgeCopyNextInstruction = () => copyText(currentGptInstruction());
window.aiBridgeCopySetupHint = () => copyText(actionSetupHint());
window.aiBridgeOpenGpt = () => window.open(gptUrl(), "_blank", "noopener");
window.aiBridgeSaveGptUrl = async function(){
  const value = String(document.getElementById("aiBridgeGptUrl")?.value || "").trim();
  localStorage.setItem("aiBridgeCustomGptUrl", value || GPT_DEFAULT_URL);
  try{ await dbSet(`${SETTINGS_PATH}/customGptUrl`, value || GPT_DEFAULT_URL); }
  catch(e){ console.warn("save GPT URL failed", e); }
  toast("Custom GPT 주소를 저장했습니다.");
  renderTeacherPanel();
};
window.aiBridgeCopyDirectPrompt = function(requestId){
  const req = requestRows().find(r => r.id === requestId);
  if(!req) return toast("질문을 찾을 수 없습니다.");
  copyText(directPromptForRequest(req));
};
window.aiBridgeMarkReview = async function(requestId){
  const reason = prompt("교사 검토 사유", "교사 직접 확인 필요") || "교사 직접 확인 필요";
  await dbUpdate(`${REQUEST_PATH}/${requestId}`, {status:"review", reviewReason:reason, updatedAt:nowIso()});
  toast("검토 상태로 변경했습니다.");
};
window.aiBridgeRejectRequest = async function(requestId){
  const reason = prompt("학생에게 보일 반려 사유", "이 질문은 선생님이 직접 확인한 뒤 다시 안내할게요.");
  if(reason === null) return;
  await dbUpdate(`${REQUEST_PATH}/${requestId}`, {status:"rejected", rejectReason:reason || "선생님이 반려했습니다.", updatedAt:nowIso()});
  toast("질문을 반려했습니다.");
};

function injectStudentPanel(){
  injectStyles();
  const view = document.getElementById("studentView");
  if(!view || view.classList.contains("hidden")) return;
  const sid = selectedStudentId();
  if(!sid || !obj(state.data.students)[sid]){
    document.getElementById("aiBridgeStudentPanel")?.remove();
    return;
  }
  let panel = document.getElementById("aiBridgeStudentPanel");
  if(!panel){
    panel = document.createElement("section");
    panel.id = "aiBridgeStudentPanel";
    panel.className = "aiBridgePanel";
    view.appendChild(panel);
  }
  renderStudentPanel(panel, sid);
}
function renderStudentPanel(panel, sid){
  const mine = requestRows().filter(r => r.studentId === sid).slice(0, 6);
  const activeCount = activeRowsForStudent(sid).length;
  const todayCount = todayRowsForStudent(sid).length;
  const disabled = activeCount >= ACTIVE_LIMIT || todayCount >= DAILY_LIMIT;
  panel.innerHTML = `<div class="aiBridgeHead"><div><h2>AI 질문함</h2><p>질문은 선생님 Custom GPT를 거쳐 Google 문서 링크로 도착합니다.</p></div><span class="aiBridgeBadge ${disabled?'orange':'green'}">오늘 ${todayCount}/${DAILY_LIMIT}</span></div>
    <div class="aiBridgeComposer">
      <select id="aiBridgeMode"><option value="concept">개념 설명</option><option value="hint">힌트만 받기</option><option value="writing">글쓰기 피드백</option><option value="quiz">문제 만들어줘</option></select>
      <textarea id="aiBridgeQuestionText" maxlength="${MAX_QUESTION_LENGTH}" placeholder="선생님 AI에게 보낼 질문을 적어 보세요. 이름, 전화번호, 주소, 비밀번호 같은 개인정보는 쓰지 마세요." ${disabled?'disabled':''}></textarea>
      <div class="aiBridgeToolbar"><button class="primary" onclick="aiBridgeSubmitQuestion()" ${disabled?'disabled':''}>질문 보내기</button><span class="aiBridgeSmall">대기/처리 중 ${activeCount}/${ACTIVE_LIMIT} · ${MAX_QUESTION_LENGTH}자 이내</span></div>
    </div>
    <div class="aiBridgeStudentHistory"><h3>내 질문 기록</h3><div class="aiBridgeList">${mine.length ? mine.map(studentRequestCardHtml).join("") : `<div class="aiBridgeEmpty">아직 보낸 질문이 없습니다.</div>`}</div></div>`;
}
function studentRequestCardHtml(req){
  const link = req.documentUrl ? `<a class="aiBridgeAnswerLink" href="${escapeHtml(req.documentUrl)}" target="_blank" rel="noopener">답변 문서 열기</a>` : "";
  const reason = req.rejectReason || req.reviewReason || req.error || "";
  return `<div class="aiBridgeCard"><div class="aiBridgeCardTop"><div><div class="aiBridgeQuestion">${escapeHtml(oneLine(req.question, 80))}</div><div class="aiBridgeMeta">${escapeHtml(req.createdAt || "")}</div></div><span class="aiBridgeBadge ${statusClass(req.status)}">${statusText(req.status)}</span></div>${reason?`<div class="aiBridgeDocPreview">${escapeHtml(reason)}</div>`:""}${req.answerPreview?`<div class="aiBridgeDocPreview">${escapeHtml(req.answerPreview)}</div>`:""}${link}</div>`;
}
window.aiBridgeSubmitQuestion = async function(){
  const sid = selectedStudentId();
  if(!sid) return toast("학생 로그인이 필요합니다.");
  const text = String(document.getElementById("aiBridgeQuestionText")?.value || "").trim();
  const mode = String(document.getElementById("aiBridgeMode")?.value || "concept");
  if(!text) return toast("질문을 입력하세요.");
  if(text.length > MAX_QUESTION_LENGTH) return toast(`${MAX_QUESTION_LENGTH}자 이내로 입력하세요.`);
  if(activeRowsForStudent(sid).length >= ACTIVE_LIMIT) return toast("대기 또는 처리 중인 질문이 너무 많습니다.");
  if(todayRowsForStudent(sid).length >= DAILY_LIMIT) return toast("오늘 질문 가능 횟수를 모두 사용했습니다.");
  const requestId = id();
  const record = {
    id: requestId,
    studentId: sid,
    studentName: studentName(sid),
    mode,
    question: text,
    status: "waiting",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    source: "economy-site-ai-question-bridge"
  };
  try{
    await dbSet(`${REQUEST_PATH}/${requestId}`, record);
    const el = document.getElementById("aiBridgeQuestionText");
    if(el) el.value = "";
    toast("AI 질문함에 보냈습니다.");
  }catch(e){
    console.error("AI question submit failed", e);
    toast(`질문 전송 실패: ${e.message || e}`);
  }
};

function scheduleUiSync(){
  ensureTeacherTab();
  updateTeacherTabBadge();
  if(state.teacherTabActive) renderTeacherPanel();
  setTimeout(injectStudentPanel, 120);
}

onValue(rootRef, snapshot => {
  state.data = obj(snapshot.val());
  state.ready = true;
  scheduleUiSync();
});

const observer = new MutationObserver(() => {
  ensureTeacherTab();
  if(state.teacherTabActive){
    const panel = document.getElementById("aiQuestions");
    if(panel?.classList.contains("hidden")) window.aiBridgeOpenTeacherTab();
  }
  setTimeout(injectStudentPanel, 80);
});
observer.observe(document.body, {childList:true, subtree:true});
window.addEventListener("storage", () => setTimeout(injectStudentPanel, 80));
window.addEventListener("DOMContentLoaded", scheduleUiSync);
setTimeout(scheduleUiSync, 1000);
