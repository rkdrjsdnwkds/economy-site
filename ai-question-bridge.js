import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
const fsDb = getFirestore(app);
const rootPath = "classEconomy/main";
const rootRef = ref(db, rootPath);
const REQUEST_PATH = "aiQuestionRequests";
const SETTINGS_PATH = "aiBridgeSettings";
const AI_USAGE_COLLECTION = "aiUsageLogs";
const GPT_DEFAULT_URL = "https://chatgpt.com/";
const MAX_QUESTION_LENGTH = 500;
const DAILY_LIMIT = 5;
const ACTIVE_LIMIT = 2;

// 모델별 단가는 여기만 수정하면 됩니다. 단위: USD / 1,000,000 tokens.
// Custom GPT/ChatGPT 화면에서 발생한 토큰은 API usage 값을 직접 주지 않으므로 기본값은 0으로 둡니다.
// Apps Script에서 promptTokens/completionTokens/modelName을 받으면 이 표를 기준으로 예상 비용을 계산합니다.
const AI_MODEL_PRICING_USD_PER_1M = {
  "custom-gpt": { input: 0, output: 0 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 5.00, output: 15.00 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "gpt-4.1": { input: 2.00, output: 8.00 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  default: { input: 0, output: 0 }
};

const state = {
  data: {},
  ready: false,
  teacherTabActive: false,
  usageTabActive: false,
  studentPanelMountedFor: "",
  lastRenderKey: "",
  usageRows: [],
  usageLoadedAt: 0,
  usageLoading: false,
  usageError: ""
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
function usageDefaultModel(){ return String(settings().usageDefaultModel || localStorage.getItem("aiBridgeUsageDefaultModel") || "custom-gpt").trim() || "custom-gpt"; }
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
    .aiBridgeComposer{display:grid;gap:10px}.aiBridgeComposer textarea{width:100%;min-height:104px;border:1px solid #cbd5e1;border-radius:16px;padding:12px;font:inherit;resize:vertical;background:white}.aiBridgeComposer select,.aiBridgeInput{border:1px solid #cbd5e1;border-radius:14px;padding:10px 12px;font:inherit;background:white}.aiBridgeToolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.aiBridgeToolbar button,.aiBridgeBtn{border:0;border-radius:14px;padding:10px 13px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#0f172a}.aiBridgeToolbar button.primary,.aiBridgeBtn.primary{background:#4c8f3a;color:white}.aiBridgeToolbar button.blue,.aiBridgeBtn.blue{background:#2563eb;color:white}.aiBridgeToolbar button.green,.aiBridgeBtn.green{background:#16a34a;color:white}.aiBridgeToolbar button.orange,.aiBridgeBtn.orange{background:#f97316;color:white}.aiBridgeToolbar button.red,.aiBridgeBtn.red{background:#dc2626;color:white}.aiBridgeToolbar button:disabled,.aiBridgeBtn:disabled{opacity:.45;cursor:not-allowed}.aiBridgeSmall{font-size:12px;color:#64748b;line-height:1.5}.aiBridgeList{display:grid;gap:10px;margin-top:12px}.aiBridgeCard{border:1px solid #e2e8f0;background:white;border-radius:18px;padding:13px}.aiBridgeCardTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.aiBridgeQuestion{font-weight:900;color:#0f172a}.aiBridgeMeta{font-size:12px;color:#64748b;margin-top:4px}.aiBridgeAnswerLink{display:inline-flex;margin-top:10px;padding:8px 10px;border-radius:12px;background:#eef6ff;color:#1d4ed8;font-weight:900;text-decoration:none}.aiBridgeTeacherGrid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px}.aiBridgeQueue{display:grid;gap:10px}.aiBridgeSettings{display:grid;gap:10px}.aiBridgeEmpty{border:1px dashed #cbd5e1;border-radius:18px;padding:18px;text-align:center;color:#64748b;background:#f8fafc}.aiBridgeCount{font-size:28px;font-weight:1000;color:#14532d}.aiBridgeCopyBox{white-space:pre-wrap;background:#0f172a;color:#e2e8f0;border-radius:16px;padding:12px;font-size:12px;line-height:1.55;max-height:190px;overflow:auto}.aiBridgeStudentHistory{margin-top:18px}.aiBridgeRejectBox{display:flex;gap:8px;margin-top:10px}.aiBridgeRejectBox input{flex:1}.aiBridgeDocPreview{margin-top:8px;padding:9px;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.45}.aiUsageCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.aiUsageMetric{border:1px solid #e2e8f0;border-radius:18px;background:white;padding:14px}.aiUsageMetric b{display:block;font-size:24px;color:#14532d;margin-top:6px}.aiUsageTable{width:100%;border-collapse:collapse;background:white;border-radius:16px;overflow:hidden}.aiUsageTable th,.aiUsageTable td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}.aiUsageTable th{background:#f8fafc;color:#475569}.aiUsageTable td.num{text-align:right;font-variant-numeric:tabular-nums}.aiUsageTwoCol{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}@media(max-width:760px){.aiBridgeTeacherGrid,.aiUsageTwoCol{grid-template-columns:1fr}.aiUsageCards{grid-template-columns:1fr}.aiBridgeHead{display:block}.aiBridgeToolbar{align-items:stretch}.aiBridgeToolbar button,.aiBridgeBtn{flex:1}.aiBridgePanel{border-radius:18px;padding:14px}}
  `;
  document.head.appendChild(style);
}

function currentGptInstruction(){
  return `다음 질문 처리해.\n\n규칙:\n1. getNextQuestion 액션으로 경제교실의 가장 오래된 대기 질문을 가져와.\n2. 개인정보, 상담, 건강, 가정사, 폭력, 위험 행동, 비밀번호/연락처가 있으면 답하지 말고 markNeedsTeacherReview 액션으로 넘겨.\n3. 일반 학습 질문이면 초등학교 5학년 수준으로 짧고 친절하게 답해.\n4. 정답만 주지 말고 개념 설명 → 예시 → 다시 생각해 볼 질문 순서로 답해.\n5. 답변을 만든 뒤 saveAnswer 액션을 호출해서 Google 문서 생성과 경제교실 메신저 등록까지 완료해.\n6. saveAnswer 액션에는 가능한 경우 modelName, promptTokens, completionTokens, totalTokens도 함께 넣어. 모르면 비워도 돼.\n7. 마지막에는 선생님에게 처리 결과와 문서 링크만 짧게 보고해.`;
}
function directPromptForRequest(req){
  return `다음 학생 질문에 초등학교 5학년 수준으로 답해.\n답변은 개념 설명 → 예시 → 다시 생각해 볼 질문 순서로 작성해.\n답변 생성 후 saveAnswer 액션을 호출해 Google 문서와 경제교실 메신저 링크를 저장해.\nsaveAnswer에는 가능한 경우 modelName, promptTokens, completionTokens, totalTokens도 포함해. 모르면 비워도 돼.\n\nrequestId: ${req.id}\nstudentId: ${req.studentId}\nstudentName: ${req.studentName || studentName(req.studentId)}\nmode: ${req.mode || "concept"}\n\n학생 질문:\n${req.question}`;
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
  }
  if(!document.getElementById("aiUsageTeacherTabButton")){
    const btn = document.createElement("button");
    btn.id = "aiUsageTeacherTabButton";
    btn.type = "button";
    btn.dataset.tab = "aiUsage";
    btn.textContent = "AI 사용량";
    btn.addEventListener("click", () => window.aiBridgeOpenUsageTab());
    tabs.insertBefore(btn, tabs.querySelector('[data-tab="ledger"]') || tabs.lastElementChild);
  }
  if(!tabs.dataset.aiBridgeTabListener){
    tabs.dataset.aiBridgeTabListener = "1";
    tabs.addEventListener("click", event => {
      if(event.target?.id !== "aiBridgeTeacherTabButton") state.teacherTabActive = false;
      if(event.target?.id !== "aiUsageTeacherTabButton") state.usageTabActive = false;
    });
  }
  if(!document.getElementById("aiQuestions")){
    const section = document.createElement("section");
    section.id = "aiQuestions";
    section.className = "tabPage hidden";
    teacherView.appendChild(section);
  }
  if(!document.getElementById("aiUsage")){
    const section = document.createElement("section");
    section.id = "aiUsage";
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
function activateTeacherSection(buttonId, sectionId){
  ensureTeacherTab();
  document.querySelectorAll("#teacherTabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById(buttonId)?.classList.add("active");
  document.querySelectorAll("#teacherView .tabPage").forEach(section => section.classList.add("hidden"));
  document.getElementById(sectionId)?.classList.remove("hidden");
}
window.aiBridgeOpenTeacherTab = function(){
  state.teacherTabActive = true;
  state.usageTabActive = false;
  activateTeacherSection("aiBridgeTeacherTabButton", "aiQuestions");
  renderTeacherPanel();
};
window.aiBridgeOpenUsageTab = async function(){
  state.usageTabActive = true;
  state.teacherTabActive = false;
  activateTeacherSection("aiUsageTeacherTabButton", "aiUsage");
  renderUsagePanel();
  await loadUsageRows();
  renderUsagePanel();
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
  const usageModel = usageDefaultModel();
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
          <label class="aiBridgeSmall"><b>사용량 기본 모델명</b><br><input class="aiBridgeInput" id="aiBridgeUsageDefaultModel" value="${escapeHtml(usageModel)}" placeholder="custom-gpt" style="width:100%;margin-top:6px"></label>
          <div class="aiBridgeToolbar"><button class="green" onclick="aiBridgeSaveGptUrl()">설정 저장</button><button onclick="aiBridgeOpenGpt()">열기</button><button class="blue" onclick="aiBridgeOpenUsageTab()">AI 사용량 보기</button></div>
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
  const usageModel = String(document.getElementById("aiBridgeUsageDefaultModel")?.value || "custom-gpt").trim() || "custom-gpt";
  localStorage.setItem("aiBridgeCustomGptUrl", value || GPT_DEFAULT_URL);
  localStorage.setItem("aiBridgeUsageDefaultModel", usageModel);
  try{ await dbUpdate(SETTINGS_PATH, {customGptUrl:value || GPT_DEFAULT_URL, usageDefaultModel:usageModel}); }
  catch(e){ console.warn("save GPT settings failed", e); }
  toast("AI 연결 설정을 저장했습니다.");
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

function localDayString(ms){
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function numberOrZero(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function money(value){ return `$${numberOrZero(value).toFixed(6)}`; }
function tokens(value){ return `${Math.round(numberOrZero(value)).toLocaleString()} 토큰`; }
function usageCreatedAtMs(row){
  if(Number.isFinite(Number(row.createdAtMs))) return Number(row.createdAtMs);
  const parsed = Date.parse(row.createdAt || row.timestamp || "");
  return Number.isFinite(parsed) ? parsed : 0;
}
async function loadUsageRows(force=false){
  if(state.usageLoading) return;
  if(!force && state.usageRows.length && Date.now() - state.usageLoadedAt < 60000) return;
  state.usageLoading = true;
  state.usageError = "";
  renderUsagePanel();
  try{
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const q = query(collection(fsDb, AI_USAGE_COLLECTION), where("createdAtMs", ">=", cutoff), orderBy("createdAtMs", "desc"), limit(500));
    const snap = await getDocs(q);
    state.usageRows = snap.docs.map(docSnap => ({id:docSnap.id, ...docSnap.data()}));
    state.usageLoadedAt = Date.now();
  }catch(e){
    console.error("AI usage load failed", e);
    state.usageError = e.message || String(e);
  }finally{
    state.usageLoading = false;
  }
}
function summarizeUsage(rows){
  const now = Date.now();
  const today = localDayString(now);
  const cut7 = now - 7 * 24 * 60 * 60 * 1000;
  const cut30 = now - 30 * 24 * 60 * 60 * 1000;
  const sum = items => items.reduce((acc, row) => {
    acc.prompt += numberOrZero(row.prompt_tokens ?? row.promptTokens);
    acc.completion += numberOrZero(row.completion_tokens ?? row.completionTokens);
    acc.total += numberOrZero(row.total_tokens ?? row.totalTokens);
    acc.cost += numberOrZero(row.estimatedCostUsd);
    acc.calls += 1;
    if(row.error) acc.errors += 1;
    return acc;
  }, {prompt:0, completion:0, total:0, cost:0, calls:0, errors:0});
  const todayRows = rows.filter(row => localDayString(usageCreatedAtMs(row)) === today);
  const rows7 = rows.filter(row => usageCreatedAtMs(row) >= cut7);
  const rows30 = rows.filter(row => usageCreatedAtMs(row) >= cut30);
  return {today:sum(todayRows), days7:sum(rows7), days30:sum(rows30)};
}
function groupUsage(rows, keyFn){
  const map = new Map();
  rows.forEach(row => {
    const key = keyFn(row) || "unknown";
    const prev = map.get(key) || {key, calls:0, prompt:0, completion:0, total:0, cost:0, errors:0};
    prev.calls += 1;
    prev.prompt += numberOrZero(row.prompt_tokens ?? row.promptTokens);
    prev.completion += numberOrZero(row.completion_tokens ?? row.completionTokens);
    prev.total += numberOrZero(row.total_tokens ?? row.totalTokens);
    prev.cost += numberOrZero(row.estimatedCostUsd);
    if(row.error) prev.errors += 1;
    map.set(key, prev);
  });
  return [...map.values()].sort((a,b)=>b.total-a.total || b.calls-a.calls);
}
function usageTableHtml(rows, title){
  return `<div class="aiBridgeCard"><h3>${escapeHtml(title)}</h3><table class="aiUsageTable"><thead><tr><th>구분</th><th class="num">호출</th><th class="num">토큰</th><th class="num">예상 비용</th><th class="num">오류</th></tr></thead><tbody>${rows.length ? rows.slice(0, 12).map(row => `<tr><td>${escapeHtml(row.key)}</td><td class="num">${row.calls.toLocaleString()}</td><td class="num">${Math.round(row.total).toLocaleString()}</td><td class="num">${money(row.cost)}</td><td class="num">${row.errors.toLocaleString()}</td></tr>`).join("") : `<tr><td colspan="5">기록이 없습니다.</td></tr>`}</tbody></table></div>`;
}
function renderUsagePanel(){
  const panel = document.getElementById("aiUsage");
  if(!panel) return;
  const rows = state.usageRows || [];
  const summary = summarizeUsage(rows);
  const byFeature = groupUsage(rows, row => row.featureName || row.feature || row.action);
  const byUser = groupUsage(rows, row => row.userId || row.studentId || row.userRole || row.role);
  const recent = [...rows].sort((a,b)=>usageCreatedAtMs(b)-usageCreatedAtMs(a)).slice(0, 12);
  const totalCost = summary.days30.cost;
  panel.innerHTML = `<div class="aiBridgePanel">
    <div class="aiBridgeHead">
      <div><h2>AI 사용량</h2><p>Firestore <b>${AI_USAGE_COLLECTION}</b> 컬렉션 기준입니다. 학생 질문 원문과 AI 답변 원문은 저장하지 않고 토큰·비용·상태만 집계합니다.</p></div>
      <div class="aiBridgeToolbar"><button class="primary" onclick="aiBridgeRefreshUsage()" ${state.usageLoading?'disabled':''}>새로고침</button><span class="aiBridgeBadge ${state.usageError?'red':'green'}">${state.usageLoading?'불러오는 중':state.usageError?'오류':'최근 30일'}</span></div>
    </div>
    ${state.usageError ? `<div class="aiBridgeCard"><b>사용량을 불러오지 못했습니다.</b><p class="aiBridgeSmall">${escapeHtml(state.usageError)}</p><p class="aiBridgeSmall">Firestore Rules에서 교사 계정의 aiUsageLogs 읽기 권한을 확인하세요.</p></div>` : ""}
    <div class="aiUsageCards">
      <div class="aiUsageMetric"><span>오늘 사용 토큰</span><b>${tokens(summary.today.total)}</b><div class="aiBridgeMeta">${summary.today.calls}회 · ${money(summary.today.cost)}</div></div>
      <div class="aiUsageMetric"><span>최근 7일 사용 토큰</span><b>${tokens(summary.days7.total)}</b><div class="aiBridgeMeta">${summary.days7.calls}회 · ${money(summary.days7.cost)}</div></div>
      <div class="aiUsageMetric"><span>최근 30일 사용 토큰</span><b>${tokens(summary.days30.total)}</b><div class="aiBridgeMeta">${summary.days30.calls}회 · ${money(totalCost)}</div></div>
    </div>
    <div class="aiUsageTwoCol">${usageTableHtml(byFeature, "기능별 사용량")}${usageTableHtml(byUser, "사용자별 사용량")}</div>
    <div class="aiBridgeCard" style="margin-top:14px"><h3>최근 호출 로그</h3><table class="aiUsageTable"><thead><tr><th>시각</th><th>기능</th><th>사용자/역할</th><th>모델</th><th class="num">토큰</th><th class="num">비용</th><th>상태</th></tr></thead><tbody>${recent.length ? recent.map(row => `<tr><td>${escapeHtml(row.createdAt || "")}</td><td>${escapeHtml(row.featureName || row.feature || row.action || "")}</td><td>${escapeHtml(row.userId || row.studentId || row.userRole || row.role || "")}</td><td>${escapeHtml(row.modelName || row.model || "")}${row.isEstimated ? " <span class=\"aiBridgeBadge gray\">추정</span>" : ""}</td><td class="num">${Math.round(numberOrZero(row.total_tokens ?? row.totalTokens)).toLocaleString()}</td><td class="num">${money(row.estimatedCostUsd)}</td><td>${row.error ? `<span class="aiBridgeBadge red">오류</span>` : `<span class="aiBridgeBadge green">정상</span>`}</td></tr>`).join("") : `<tr><td colspan="7">아직 기록이 없습니다.</td></tr>`}</tbody></table></div>
  </div>`;
}
window.aiBridgeRefreshUsage = async function(){
  await loadUsageRows(true);
  renderUsagePanel();
};
window.aiBridgeUsagePricing = AI_MODEL_PRICING_USD_PER_1M;

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
  if(state.usageTabActive) renderUsagePanel();
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
  if(state.usageTabActive){
    const panel = document.getElementById("aiUsage");
    if(panel?.classList.contains("hidden")) window.aiBridgeOpenUsageTab();
  }
  setTimeout(injectStudentPanel, 80);
});
observer.observe(document.body, {childList:true, subtree:true});
window.addEventListener("storage", () => setTimeout(injectStudentPanel, 80));
window.addEventListener("DOMContentLoaded", scheduleUiSync);
setTimeout(scheduleUiSync, 1000);
