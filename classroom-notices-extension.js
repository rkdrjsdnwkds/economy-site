import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtwpc4THHE_t3fSfV-FgS4KHF2krUosvA",
  authDomain: "economy-44982.firebaseapp.com",
  databaseURL: "https://economy-44982-default-rtdb.firebaseio.com",
  projectId: "economy-44982",
  storageBucket: "economy-44982.firebasestorage.app",
  messagingSenderId: "979007941269",
  appId: "1:979007941269:web:140c0a114b64ffecd1899c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const rootPath = "classEconomy/main";
const rootRef = ref(db, rootPath);
let data = {};
let activeType = "all";

const $ = (id) => document.getElementById(id);
const obj = (v) => v && typeof v === "object" ? v : {};
const arr = (v) => Object.values(obj(v));
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
const now = () => new Date().toISOString();
const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const dbSet = (p, v) => set(ref(db, `${rootPath}/${p}`), v);
const dbUpdate = (p, v) => update(ref(db, `${rootPath}/${p}`), v);

function toast(msg){
  const old = document.querySelector(".noticeExtToast");
  if(old) old.remove();
  const el = document.createElement("div");
  el.className = "toast noticeExtToast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function students(){
  return arr(data.students).filter(s => s && s.id && !s.archived)
    .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""), "ko"));
}
function studentName(id){ return students().find(s=>s.id===id)?.name || id || "학생"; }
function notices(){
  return arr(data.classroomNotices).filter(n => n && n.id && n.deleted !== true)
    .sort((a,b)=>String(a.dueDate||"9999-12-31").localeCompare(String(b.dueDate||"9999-12-31")) || String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
}
function meta(t){ return {notice:"공지", homework:"숙제", material:"준비물", event:"행사"}[t] || "알림"; }
function statusKey(noticeId, studentId){ return `${noticeId}_${studentId}`; }
function statusOf(noticeId, studentId){
  const map = obj(data.classroomNoticeStatus);
  return map[statusKey(noticeId, studentId)] || arr(map).find(s => s.noticeId === noticeId && s.studentId === studentId) || {};
}
function targetIds(n){ return n.targetType === "selected" ? arr(n.targetStudentIds).filter(Boolean) : students().map(s=>s.id); }
function statusLabel(s){
  if(s.teacherConfirmed || s.status === "confirmed") return "선생님 확인 완료";
  if(s.status === "incomplete") return "미완료 처리";
  if(s.checked || s.status === "self_checked") return "학생 체크 완료";
  return "미체크";
}
function studentPicker(){
  const rows = students().map(s => `<label class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:3px 5px 3px 0;cursor:pointer"><input type="checkbox" class="noticeTargetStudent" value="${esc(s.id)}"> ${esc(s.name || s.id)}</label>`).join("");
  return rows || `<div class="small">학생 목록이 없습니다.</div>`;
}

function ensurePanel(){
  const tabs = $("teacherTabs");
  const view = $("teacherView");
  if(!tabs || !view) return;
  let btn = document.querySelector('#teacherTabs button[data-tab="classroomNotices"]');
  if(!btn){
    btn = document.createElement("button");
    btn.dataset.tab = "classroomNotices";
    btn.textContent = "알림장";
    const before = document.querySelector('#teacherTabs button[data-tab="settings"]');
    tabs.insertBefore(btn, before || null);
  }
  btn.onclick = null;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    openNoticeTab();
  }, true);

  let panel = $("classroomNotices");
  if(!panel){
    panel = document.createElement("section");
    panel.id = "classroomNotices";
    panel.className = "tabPage hidden";
    view.appendChild(panel);
  }
}

function openNoticeTab(){
  ensurePanel();
  document.querySelectorAll("#teacherTabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === "classroomNotices"));
  document.querySelectorAll("#teacherView .tabPage").forEach(p => p.classList.add("hidden"));
  const panel = $("classroomNotices");
  if(panel) panel.classList.remove("hidden");
  renderTeacherNotices();
}

function noticeCard(n){
  const ids = targetIds(n);
  const checked = ids.filter(id => {
    const s = statusOf(n.id, id);
    return s.checked || s.status === "self_checked" || s.status === "confirmed" || s.teacherConfirmed;
  }).length;
  const confirmed = ids.filter(id => {
    const s = statusOf(n.id, id);
    return s.teacherConfirmed || s.status === "confirmed";
  }).length;
  const targetText = n.targetType === "selected" ? ids.map(studentName).join(", ") : "전체 학생";
  const rows = ids.map(id => {
    const s = statusOf(n.id, id);
    return `<tr><td>${esc(studentName(id))}</td><td>${esc(statusLabel(s))}</td><td>${s.checkedAt ? esc(new Date(s.checkedAt).toLocaleString("ko-KR")) : "-"}</td><td><button onclick="confirmClassroomNoticeStatus('${esc(n.id)}','${esc(id)}','confirmed')">확인 완료</button> <button onclick="confirmClassroomNoticeStatus('${esc(n.id)}','${esc(id)}','incomplete')">미완료</button></td></tr>`;
  }).join("");
  return `<div class="card">
    <div class="head"><div><h3>${n.important ? "⭐ " : ""}${esc(n.title || "제목 없음")}</h3><div class="sub"><span class="pill">${esc(meta(n.type))}</span> ${esc(n.dueDate || "날짜 없음")} · ${esc(targetText)}</div></div><button onclick="deleteClassroomNotice('${esc(n.id)}')">삭제</button></div>
    <p>${esc(n.content || "")}</p>
    <div class="grid3"><div><b>${ids.length}</b><div class="small">대상</div></div><div><b>${checked}</b><div class="small">학생 체크</div></div><div><b>${confirmed}</b><div class="small">교사 확인</div></div></div>
    <details style="margin-top:10px"><summary>학생별 현황 보기</summary><div class="tableWrap"><table><thead><tr><th>학생</th><th>상태</th><th>체크 시간</th><th>처리</th></tr></thead><tbody>${rows || `<tr><td colspan="4">대상 학생이 없습니다.</td></tr>`}</tbody></table></div></details>
  </div>`;
}

function renderTeacherNotices(){
  const panel = $("classroomNotices");
  if(!panel) return;
  const all = notices();
  const list = activeType === "all" ? all : all.filter(n => n.type === activeType);
  panel.innerHTML = `<section class="section">
    <div class="head"><div><h2>알림장</h2><div class="sub">알림 등록, 숙제·준비물 체크, 학생 메시지를 관리합니다.</div></div><button class="primary" onclick="document.getElementById('noticeCreateBox')?.scrollIntoView({behavior:'smooth', block:'start'})">새 알림 등록</button></div>
  </section>
  <section id="noticeCreateBox" class="section">
    <h3>새 알림 등록</h3>
    <div class="grid2">
      <label>제목<input id="noticeTitle" placeholder="예: 수학 익힘 42~43쪽"></label>
      <label>유형<select id="noticeType"><option value="notice">공지</option><option value="homework">숙제</option><option value="material">준비물</option><option value="event">행사</option></select></label>
      <label>마감일/행사일<input id="noticeDueDate" type="date"></label>
      <label>대상<select id="noticeTargetType" onchange="document.getElementById('noticeStudentPicker').classList.toggle('hidden', this.value !== 'selected')"><option value="all">전체 학생</option><option value="selected">개별 학생</option></select></label>
    </div>
    <label>내용<textarea id="noticeContent" rows="4" placeholder="학생에게 보여줄 내용을 입력하세요."></textarea></label>
    <label class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:8px 0;cursor:pointer"><input id="noticeImportant" type="checkbox"> 중요 알림</label>
    <div id="noticeStudentPicker" class="hidden" style="margin:8px 0">${studentPicker()}</div>
    <div class="rowActions"><button class="primary" onclick="createClassroomNotice()">저장</button><button onclick="clearClassroomNoticeForm()">초기화</button></div>
  </section>
  <section class="section">
    <div class="head"><div><h3>알림 목록</h3><div class="sub">총 ${all.length}개</div></div><select onchange="setClassroomNoticeFilter(this.value)"><option value="all" ${activeType==="all"?"selected":""}>전체</option><option value="homework" ${activeType==="homework"?"selected":""}>숙제</option><option value="material" ${activeType==="material"?"selected":""}>준비물</option><option value="event" ${activeType==="event"?"selected":""}>행사</option><option value="notice" ${activeType==="notice"?"selected":""}>공지</option></select></div>
    <div class="grid">${list.map(noticeCard).join("") || `<div class="empty">등록된 알림이 없습니다.</div>`}</div>
  </section>`;
}

window.createClassroomNotice = async function(){
  try{
    const title = $("noticeTitle")?.value.trim();
    if(!title){ toast("제목을 입력하세요."); return; }
    const targetType = $("noticeTargetType")?.value || "all";
    const targetStudentIds = targetType === "selected" ? Array.from(document.querySelectorAll(".noticeTargetStudent:checked")).map(el=>el.value) : [];
    if(targetType === "selected" && targetStudentIds.length === 0){ toast("대상 학생을 선택하세요."); return; }
    const id = uid("notice");
    await dbSet(`classroomNotices/${id}`, { id, title, content: $("noticeContent")?.value.trim() || "", type: $("noticeType")?.value || "notice", targetType, targetStudentIds, dueDate: $("noticeDueDate")?.value || "", important: !!$("noticeImportant")?.checked, createdBy: "teacher", createdAt: now(), updatedAt: now(), deleted: false });
    clearClassroomNoticeForm();
    toast("알림장이 등록됐습니다.");
  }catch(e){ console.error(e); toast(`저장 실패: ${e.message || e}`); }
};

window.clearClassroomNoticeForm = function(){
  ["noticeTitle","noticeContent","noticeDueDate"].forEach(id => { const el = $(id); if(el) el.value = ""; });
  if($("noticeType")) $("noticeType").value = "notice";
  if($("noticeTargetType")) $("noticeTargetType").value = "all";
  if($("noticeImportant")) $("noticeImportant").checked = false;
  document.querySelectorAll(".noticeTargetStudent").forEach(el => el.checked = false);
  $("noticeStudentPicker")?.classList.add("hidden");
};
window.deleteClassroomNotice = async function(id){ if(confirm("이 알림을 삭제할까요?")) await dbUpdate(`classroomNotices/${id}`, {deleted:true, updatedAt:now()}); };
window.confirmClassroomNoticeStatus = async function(noticeId, studentId, status="confirmed"){
  const key = statusKey(noticeId, studentId);
  const old = statusOf(noticeId, studentId);
  await dbSet(`classroomNoticeStatus/${key}`, {id:key, noticeId, studentId, checked: status === "confirmed" ? true : !!old.checked, checkedAt: old.checkedAt || "", teacherConfirmed: status === "confirmed", teacherConfirmedAt: status === "confirmed" ? now() : "", status, updatedAt:now()});
};
window.setClassroomNoticeFilter = function(type){ activeType = type || "all"; renderTeacherNotices(); };

function boot(){
  ensurePanel();
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest('#teacherTabs button[data-tab="classroomNotices"]');
    if(btn){ e.preventDefault(); e.stopImmediatePropagation(); openNoticeTab(); }
  }, true);
  onValue(rootRef, snap => {
    data = snap.val() || {};
    ensurePanel();
    if(!$("classroomNotices")?.classList.contains("hidden")) renderTeacherNotices();
  });
  new MutationObserver(ensurePanel).observe(document.body, {childList:true, subtree:true});
  setInterval(ensurePanel, 1000);
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
