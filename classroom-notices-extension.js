import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
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

let economyData = {};
let ready = false;
let activeNoticeType = "all";

function obj(value){ return value && typeof value === "object" ? value : {}; }
function arr(value){ return Object.values(obj(value)); }
function today(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function nowIso(){ return new Date().toISOString(); }
function uid(prefix="id"){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
}
function safe(text){
  return String(text ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}
function noticeToast(message){
  const old = document.querySelector(".noticeExtToast");
  if(old) old.remove();
  const el = document.createElement("div");
  el.className = "toast noticeExtToast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),2600);
}
function students(){
  return arr(economyData.students).filter(s=>s && s.id && !s.archived).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ko"));
}
function studentName(id){
  return students().find(s=>s.id===id)?.name || id || "학생";
}
function notices(){
  return arr(economyData.classroomNotices).filter(n=>n && n.id && n.deleted !== true)
    .sort((a,b)=>String(a.dueDate||"9999-12-31").localeCompare(String(b.dueDate||"9999-12-31")) || String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
}
function typeMeta(type){
  return {
    notice:{label:"공지", button:"확인했어요"},
    homework:{label:"숙제", button:"했어요"},
    material:{label:"준비물", button:"확인했어요"},
    event:{label:"행사", button:"확인했어요"}
  }[type] || {label:"알림", button:"확인했어요"};
}
function targetIds(notice){
  if(notice.targetType === "selected") return arr(notice.targetStudentIds).filter(Boolean);
  return students().map(s=>s.id);
}
function statusKey(noticeId, studentId){ return `${noticeId}_${studentId}`; }
function statusOf(noticeId, studentId){
  const direct = obj(economyData.classroomNoticeStatus)[statusKey(noticeId, studentId)];
  if(direct) return direct;
  return arr(economyData.classroomNoticeStatus).find(s=>s.noticeId===noticeId && s.studentId===studentId) || {};
}
function statusLabel(status){
  if(status.teacherConfirmed || status.status === "confirmed") return "선생님 확인 완료";
  if(status.status === "incomplete") return "미완료 처리";
  if(status.checked || status.status === "self_checked") return "학생 체크 완료";
  return "미체크";
}
function targetText(notice){
  if(notice.targetType !== "selected") return "전체 학생";
  const names = targetIds(notice).map(studentName);
  return names.length ? names.join(", ") : "개별 학생 없음";
}
function dbSet(path, value){ return set(ref(db, `${rootPath}/${path}`), value); }
function dbUpdate(path, value){ return update(ref(db, `${rootPath}/${path}`), value); }

function ensureTeacherNoticeTab(){
  const tabs = document.getElementById("teacherTabs");
  const teacherView = document.getElementById("teacherView");
  if(!tabs || !teacherView) return;

  if(!document.querySelector('#teacherTabs button[data-tab="classroomNotices"]')){
    const btn = document.createElement("button");
    btn.dataset.tab = "classroomNotices";
    btn.textContent = "알림장";
    btn.addEventListener("click", openTeacherNoticeTab);
    const settingsBtn = document.querySelector('#teacherTabs button[data-tab="settings"]');
    tabs.insertBefore(btn, settingsBtn || null);
  }
  if(!document.getElementById("classroomNotices")){
    const section = document.createElement("section");
    section.id = "classroomNotices";
    section.className = "tabPage hidden";
    teacherView.appendChild(section);
  }
}

function openTeacherNoticeTab(){
  ensureTeacherNoticeTab();
  document.querySelectorAll("#teacherTabs button").forEach(b=>b.classList.toggle("active", b.dataset.tab === "classroomNotices"));
  document.querySelectorAll("#teacherView .tabPage").forEach(page=>page.classList.add("hidden"));
  const panel = document.getElementById("classroomNotices");
  if(panel) panel.classList.remove("hidden");
  renderTeacherNotices();
}

function studentPickerHtml(){
  const rows = students().map(s=>`<label class="pill" style="cursor:pointer;display:inline-flex;gap:6px;align-items:center;margin:3px 4px 3px 0"><input type="checkbox" class="noticeTargetStudent" value="${safe(s.id)}"> ${safe(s.name||s.id)}</label>`).join("");
  return rows || `<div class="small">학생 목록이 없습니다. 먼저 학생을 등록하세요.</div>`;
}

function teacherNoticeCardHtml(notice){
  const meta = typeMeta(notice.type);
  const ids = targetIds(notice);
  const statusList = ids.map(id=>statusOf(notice.id,id));
  const checked = statusList.filter(s=>s.checked || s.status === "self_checked" || s.status === "confirmed" || s.teacherConfirmed).length;
  const confirmed = statusList.filter(s=>s.teacherConfirmed || s.status === "confirmed").length;
  const unchecked = Math.max(0, ids.length - checked);
  const studentRows = ids.map(id=>{
    const st = statusOf(notice.id,id);
    return `<tr>
      <td>${safe(studentName(id))}</td>
      <td>${safe(statusLabel(st))}</td>
      <td>${st.checkedAt ? safe(new Date(st.checkedAt).toLocaleString("ko-KR")) : "-"}</td>
      <td class="rowActions">
        <button onclick="confirmClassroomNoticeStatus('${safe(notice.id)}','${safe(id)}','confirmed')">확인 완료</button>
        <button onclick="confirmClassroomNoticeStatus('${safe(notice.id)}','${safe(id)}','incomplete')">미완료</button>
      </td>
    </tr>`;
  }).join("");
  return `<div class="card">
    <div class="head">
      <div>
        <h3>${notice.important ? "⭐ " : ""}${safe(notice.title || "제목 없음")}</h3>
        <div class="sub"><span class="pill">${meta.label}</span> 대상: ${safe(targetText(notice))} · ${notice.dueDate ? safe(notice.dueDate) : "날짜 없음"}</div>
      </div>
      <button onclick="deleteClassroomNotice('${safe(notice.id)}')">삭제</button>
    </div>
    <p>${safe(notice.content || "")}</p>
    <div class="grid3">
      <div><b>${ids.length}</b><div class="small">대상</div></div>
      <div><b>${checked}</b><div class="small">학생 체크</div></div>
      <div><b>${confirmed}</b><div class="small">교사 확인</div></div>
    </div>
    <div class="small">미체크 ${unchecked}명</div>
    <details style="margin-top:10px">
      <summary>학생별 현황 보기</summary>
      <div class="tableWrap"><table><thead><tr><th>학생</th><th>상태</th><th>체크 시간</th><th>처리</th></tr></thead><tbody>${studentRows || `<tr><td colspan="4">대상 학생이 없습니다.</td></tr>`}</tbody></table></div>
    </details>
  </div>`;
}

function renderTeacherNotices(){
  const panel = document.getElementById("classroomNotices");
  if(!panel) return;
  const allNotices = notices();
  const filtered = activeNoticeType === "all" ? allNotices : allNotices.filter(n=>n.type === activeNoticeType);
  panel.innerHTML = `<section class="section">
    <div class="head">
      <div>
        <h2>알림장</h2>
        <div class="sub">공지·숙제·준비물·행사를 등록하고 학생별 체크 현황을 확인합니다.</div>
      </div>
      <button class="primary" onclick="document.getElementById('noticeCreateBox')?.scrollIntoView({behavior:'smooth',block:'start'})">새 알림 등록</button>
    </div>
  </section>

  <section id="noticeCreateBox" class="section">
    <h3>새 알림 등록</h3>
    <div class="grid2">
      <label>제목<input id="noticeTitle" placeholder="예: 수학 익힘 42~43쪽"></label>
      <label>유형<select id="noticeType">
        <option value="notice">공지</option>
        <option value="homework">숙제</option>
        <option value="material">준비물</option>
        <option value="event">행사</option>
      </select></label>
      <label>마감일/행사일<input id="noticeDueDate" type="date"></label>
      <label>대상<select id="noticeTargetType" onchange="document.getElementById('noticeStudentPicker').classList.toggle('hidden', this.value!=='selected')">
        <option value="all">전체 학생</option>
        <option value="selected">개별 학생</option>
      </select></label>
    </div>
    <label>내용<textarea id="noticeContent" rows="4" placeholder="학생에게 보여줄 내용을 입력하세요."></textarea></label>
    <label class="pill" style="cursor:pointer;display:inline-flex;gap:6px;align-items:center;margin:8px 0"><input id="noticeImportant" type="checkbox"> 중요 알림</label>
    <div id="noticeStudentPicker" class="hidden" style="margin:8px 0">${studentPickerHtml()}</div>
    <div class="rowActions">
      <button class="primary" onclick="createClassroomNotice()">저장</button>
      <button onclick="clearClassroomNoticeForm()">입력 초기화</button>
    </div>
  </section>

  <section class="section">
    <div class="head">
      <div>
        <h3>알림 목록</h3>
        <div class="sub">총 ${allNotices.length}개</div>
      </div>
      <select onchange="setClassroomNoticeFilter(this.value)">
        <option value="all" ${activeNoticeType==="all"?"selected":""}>전체</option>
        <option value="homework" ${activeNoticeType==="homework"?"selected":""}>숙제</option>
        <option value="material" ${activeNoticeType==="material"?"selected":""}>준비물</option>
        <option value="event" ${activeNoticeType==="event"?"selected":""}>행사</option>
        <option value="notice" ${activeNoticeType==="notice"?"selected":""}>공지</option>
      </select>
    </div>
    <div class="grid">${filtered.map(teacherNoticeCardHtml).join("") || `<div class="empty">등록된 알림이 없습니다.</div>`}</div>
  </section>`;
}

window.createClassroomNotice = async function(){
  try{
    const title = document.getElementById("noticeTitle")?.value.trim();
    const content = document.getElementById("noticeContent")?.value.trim() || "";
    const type = document.getElementById("noticeType")?.value || "notice";
    const targetType = document.getElementById("noticeTargetType")?.value || "all";
    const dueDate = document.getElementById("noticeDueDate")?.value || "";
    const important = !!document.getElementById("noticeImportant")?.checked;
    const targetStudentIds = targetType === "selected" ? Array.from(document.querySelectorAll(".noticeTargetStudent:checked")).map(el=>el.value) : [];
    if(!title){ noticeToast("제목을 입력하세요."); return; }
    if(targetType === "selected" && targetStudentIds.length === 0){ noticeToast("개별 대상을 선택하세요."); return; }
    const id = uid("notice");
    await dbSet(`classroomNotices/${id}`, {
      id, title, content, type, targetType, targetStudentIds, dueDate,
      important, createdBy:"teacher", createdAt:nowIso(), updatedAt:nowIso(), deleted:false
    });
    clearClassroomNoticeForm();
    noticeToast("알림장이 등록됐습니다.");
  }catch(error){
    console.error("createClassroomNotice failed", error);
    noticeToast(`저장 실패: ${error.message || error}`);
  }
};

window.clearClassroomNoticeForm = function(){
  ["noticeTitle","noticeContent","noticeDueDate"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
  const type=document.getElementById("noticeType"); if(type) type.value="notice";
  const target=document.getElementById("noticeTargetType"); if(target) target.value="all";
  const important=document.getElementById("noticeImportant"); if(important) important.checked=false;
  document.querySelectorAll(".noticeTargetStudent").forEach(el=>el.checked=false);
  document.getElementById("noticeStudentPicker")?.classList.add("hidden");
};

window.deleteClassroomNotice = async function(id){
  if(!confirm("이 알림을 삭제할까요?")) return;
  await dbUpdate(`classroomNotices/${id}`, {deleted:true, updatedAt:nowIso()});
  noticeToast("삭제했습니다.");
};

window.confirmClassroomNoticeStatus = async function(noticeId, studentId, status="confirmed"){
  const key = statusKey(noticeId, studentId);
  const previous = statusOf(noticeId, studentId);
  await dbSet(`classroomNoticeStatus/${key}`, {
    id:key, noticeId, studentId,
    checked: status === "confirmed" ? true : !!previous.checked,
    checkedAt: previous.checkedAt || "",
    teacherConfirmed: status === "confirmed",
    teacherConfirmedAt: status === "confirmed" ? nowIso() : "",
    status,
    updatedAt: nowIso()
  });
  noticeToast(status === "confirmed" ? "확인 완료 처리했습니다." : "미완료 처리했습니다.");
};

window.setClassroomNoticeFilter = function(type){
  activeNoticeType = type || "all";
  renderTeacherNotices();
};

function boot(){
  ensureTeacherNoticeTab();
  onValue(rootRef, snap=>{
    economyData = snap.val() || {};
    ready = true;
    ensureTeacherNoticeTab();
    if(!document.getElementById("classroomNotices")?.classList.contains("hidden")) renderTeacherNotices();
  });
  const observer = new MutationObserver(()=>ensureTeacherNoticeTab());
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(ensureTeacherNoticeTab,1500);
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
