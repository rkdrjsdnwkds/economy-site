import { getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const app = getApp();
const db = getDatabase(app);
const usageRef = ref(db, "classEconomy/main/aiUsageLogs");
const state = { rows: [], active: false, ready: false };

function esc(text=""){
  return String(text).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function arr(map){ return Object.values(map || {}).filter(v => v && typeof v === "object"); }
function n(value){ const x = Number(value); return Number.isFinite(x) ? x : 0; }
function ms(row){ const direct = Number(row.createdAtMs); if(Number.isFinite(direct)) return direct; const parsed = Date.parse(row.createdAt || ""); return Number.isFinite(parsed) ? parsed : 0; }
function kstDay(time){ return new Date(time + 9*60*60*1000).toISOString().slice(0,10); }
function money(value){ return `$${n(value).toFixed(6)}`; }
function token(value){ return `${Math.round(n(value)).toLocaleString()} 토큰`; }
function sum(rows){
  return rows.reduce((a,row)=>{
    a.calls += 1;
    a.prompt += n(row.prompt_tokens ?? row.promptTokens);
    a.completion += n(row.completion_tokens ?? row.completionTokens);
    a.total += n(row.total_tokens ?? row.totalTokens);
    a.cost += n(row.estimatedCostUsd);
    if(row.error) a.errors += 1;
    return a;
  }, {calls:0,prompt:0,completion:0,total:0,cost:0,errors:0});
}
function group(rows, keyFn){
  const map = new Map();
  rows.forEach(row=>{
    const key = keyFn(row) || "unknown";
    const prev = map.get(key) || {key,calls:0,total:0,cost:0,errors:0};
    prev.calls += 1;
    prev.total += n(row.total_tokens ?? row.totalTokens);
    prev.cost += n(row.estimatedCostUsd);
    if(row.error) prev.errors += 1;
    map.set(key, prev);
  });
  return [...map.values()].sort((a,b)=>b.total-a.total || b.calls-a.calls);
}
function table(rows, title){
  return `<div class="aiBridgeCard"><h3>${esc(title)}</h3><table class="aiUsageTable"><thead><tr><th>구분</th><th class="num">호출</th><th class="num">토큰</th><th class="num">예상 비용</th><th class="num">오류</th></tr></thead><tbody>${rows.length ? rows.slice(0,12).map(row=>`<tr><td>${esc(row.key)}</td><td class="num">${row.calls.toLocaleString()}</td><td class="num">${Math.round(row.total).toLocaleString()}</td><td class="num">${money(row.cost)}</td><td class="num">${row.errors.toLocaleString()}</td></tr>`).join("") : `<tr><td colspan="5">기록이 없습니다.</td></tr>`}</tbody></table></div>`;
}
function ensureUi(){
  const tabs = document.getElementById("teacherTabs");
  const view = document.getElementById("teacherView");
  if(!tabs || !view) return false;
  let btn = document.getElementById("aiUsageTeacherTabButton");
  if(!btn){
    btn = document.createElement("button");
    btn.id = "aiUsageTeacherTabButton";
    btn.type = "button";
    btn.dataset.tab = "aiUsage";
    btn.textContent = "AI 사용량";
    tabs.insertBefore(btn, tabs.querySelector('[data-tab="ledger"]') || tabs.lastElementChild);
  }
  if(!btn.dataset.rtdbUsageHook){
    btn.dataset.rtdbUsageHook = "1";
    btn.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openUsage();
    }, true);
  }
  let section = document.getElementById("aiUsage");
  if(!section){
    section = document.createElement("section");
    section.id = "aiUsage";
    section.className = "tabPage hidden";
    view.appendChild(section);
  }
  return true;
}
function openUsage(){
  if(!ensureUi()) return;
  state.active = true;
  document.querySelectorAll("#teacherTabs button").forEach(btn=>btn.classList.remove("active"));
  document.getElementById("aiUsageTeacherTabButton")?.classList.add("active");
  document.querySelectorAll("#teacherView .tabPage").forEach(section=>section.classList.add("hidden"));
  document.getElementById("aiUsage")?.classList.remove("hidden");
  render();
}
function render(){
  const panel = document.getElementById("aiUsage");
  if(!panel) return;
  const now = Date.now();
  const today = kstDay(now);
  const cut7 = now - 7*24*60*60*1000;
  const cut30 = now - 30*24*60*60*1000;
  const rows = state.rows.filter(row => ms(row) >= cut30).sort((a,b)=>ms(b)-ms(a));
  const todaySum = sum(rows.filter(row => kstDay(ms(row)) === today));
  const days7 = sum(rows.filter(row => ms(row) >= cut7));
  const days30 = sum(rows);
  const byFeature = group(rows, row => row.featureName || row.feature || row.action);
  const byUser = group(rows, row => row.userId || row.studentId || row.userRole || row.role);
  const recent = rows.slice(0,12);
  panel.innerHTML = `<div class="aiBridgePanel">
    <div class="aiBridgeHead"><div><h2>AI 사용량</h2><p>Realtime Database <b>classEconomy/main/aiUsageLogs</b> 기준입니다. 질문 원문과 답변 원문은 저장하지 않습니다.</p></div><div class="aiBridgeToolbar"><button class="primary" onclick="window.aiUsageRtdbOpen()">새로고침</button><span class="aiBridgeBadge ${state.ready?'green':'gray'}">${state.ready?'최근 30일':'불러오는 중'}</span></div></div>
    <div class="aiUsageCards"><div class="aiUsageMetric"><span>오늘 사용 토큰</span><b>${token(todaySum.total)}</b><div class="aiBridgeMeta">${todaySum.calls}회 · ${money(todaySum.cost)}</div></div><div class="aiUsageMetric"><span>최근 7일 사용 토큰</span><b>${token(days7.total)}</b><div class="aiBridgeMeta">${days7.calls}회 · ${money(days7.cost)}</div></div><div class="aiUsageMetric"><span>최근 30일 사용 토큰</span><b>${token(days30.total)}</b><div class="aiBridgeMeta">${days30.calls}회 · ${money(days30.cost)}</div></div></div>
    <div class="aiUsageTwoCol">${table(byFeature,"기능별 사용량")}${table(byUser,"사용자별 사용량")}</div>
    <div class="aiBridgeCard" style="margin-top:14px"><h3>최근 호출 로그</h3><table class="aiUsageTable"><thead><tr><th>시각</th><th>기능</th><th>사용자/역할</th><th>모델</th><th class="num">토큰</th><th class="num">비용</th><th>상태</th></tr></thead><tbody>${recent.length ? recent.map(row=>`<tr><td>${esc(row.createdAt || "")}</td><td>${esc(row.featureName || "")}</td><td>${esc(row.userId || row.userRole || "")}</td><td>${esc(row.modelName || "")}${row.isEstimated ? " <span class=\"aiBridgeBadge gray\">추정</span>" : ""}</td><td class="num">${Math.round(n(row.total_tokens ?? row.totalTokens)).toLocaleString()}</td><td class="num">${money(row.estimatedCostUsd)}</td><td>${row.error ? `<span class="aiBridgeBadge red">오류</span>` : `<span class="aiBridgeBadge green">정상</span>`}</td></tr>`).join("") : `<tr><td colspan="7">아직 기록이 없습니다.</td></tr>`}</tbody></table></div>
  </div>`;
}
window.aiUsageRtdbOpen = openUsage;

onValue(usageRef, snapshot => {
  state.rows = arr(snapshot.val());
  state.ready = true;
  if(state.active) render();
});
setInterval(ensureUi, 700);
window.addEventListener("DOMContentLoaded", ensureUi);
setTimeout(ensureUi, 1200);
