// 나의 일기장 — Firebase(Firestore + Google 로그인) 버전
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MOODS = [
  ["happy","😊 기쁨"],["calm","😌 평온"],["soso","😐 그저그럼"],
  ["sad","😢 슬픔"],["angry","😠 화남"],["tired","😴 피곤"]
];
const WEATHERS = ["☀️ 맑음","⛅ 흐림","🌧️ 비","❄️ 눈","🌬️ 바람"];
const moodLabel = m => (MOODS.find(x => x[0] === m) || [, ""])[1];
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtTs = t => { if (!t || !t.toDate) return "방금"; const d = t.toDate();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

let user = null;
let state = { entries: [], currentId: null, dirty: false, q: "", day: null,
              calY: new Date().getFullYear(), calM: new Date().getMonth() };

function toast(msg, err = false) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(t._h); t._h = setTimeout(() => t.className = "toast", 2200);
}

// ---------- 로그인 ----------
const KEEP_KEY = "diary.keepLogin";
try { $("#keepLogin").checked = localStorage.getItem(KEEP_KEY) === "1"; } catch {}

$("#loginBtn").onclick = async () => {
  const keep = $("#keepLogin").checked;
  try { localStorage.setItem(KEEP_KEY, keep ? "1" : "0"); } catch {}
  try {
    await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
    if (err.code === "auth/popup-blocked") return toast("팝업이 차단되었어요. 팝업을 허용한 뒤 다시 눌러 주세요.", true);
    if (err.code === "auth/unauthorized-domain") return toast("이 주소가 Firebase 승인된 도메인에 없어요.", true);
    toast("로그인에 실패했어요: " + (err.code || err.message), true);
  }
};

$("#logoutBtn").onclick = () => guard(async () => {
  await signOut(auth);
  toast("로그아웃했어요.");
});

onAuthStateChanged(auth, async u => {
  user = u;
  $("#boot").hidden = true;
  $("#loginView").hidden = !!u;
  $("#appView").hidden = !u;
  state.entries = []; state.currentId = null; state.dirty = false; state.day = null; state.q = ""; $("#q").value = "";
  if (u) {
    $("#userName").textContent = u.displayName || u.email || "";
    showWelcome();
    await loadAll();
  }
});

// ---------- 데이터 ----------
const entriesCol = () => collection(db, "users", user.uid, "entries");

async function loadAll() {
  try {
    const snap = await getDocs(query(entriesCol(), orderBy("entry_date", "desc")));
    state.entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
    $("#count").textContent = `총 ${state.entries.length}편`;
    renderList(); renderCal();
  } catch (err) {
    toast("일기를 불러오지 못했어요: " + (err.code || err.message), true);
  }
}

function visibleEntries() {
  let items = state.entries;
  if (state.q) { const q = state.q.toLowerCase();
    items = items.filter(e => e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)); }
  if (state.day) items = items.filter(e => e.entry_date === state.day);
  return items;
}

// ---------- 목록 ----------
function renderList() {
  const list = $("#list"); list.innerHTML = "";
  const items = visibleEntries();
  const note = $("#filterNote");
  if (state.day || state.q) {
    note.hidden = false;
    $("#filterText").textContent = [state.day && state.day.replaceAll("-", ". ") + ".", state.q && `"${state.q}"`]
      .filter(Boolean).join(" · ") + ` — ${items.length}편`;
  } else note.hidden = true;

  if (!items.length) {
    const d = document.createElement("div"); d.className = "empty-list"; d.style.whiteSpace = "pre-line";
    d.textContent = state.day || state.q ? "해당하는 일기가 없어요." : "아직 쓴 일기가 없어요.\n첫 일기를 써 보세요!";
    list.appendChild(d); return;
  }
  for (const e of items) {
    const b = document.createElement("button");
    b.className = "item" + (e.id === state.currentId ? " active" : "");
    const top = document.createElement("div"); top.className = "top";
    const dt = document.createElement("span"); dt.textContent = fmtDate(e.entry_date);
    const md = document.createElement("span");
    md.textContent = [moodLabel(e.mood).split(" ")[0], (e.weather || "").split(" ")[0]].filter(Boolean).join(" ");
    top.append(dt, md);
    const t = document.createElement("div"); t.className = "t"; t.textContent = e.title || "(제목 없음)";
    const p = document.createElement("div"); p.className = "p"; p.textContent = e.content.replace(/\s+/g, " ").slice(0, 60);
    b.append(top, t, p);
    b.onclick = () => guard(() => openEntry(e.id));
    list.appendChild(b);
  }
}

function fmtDate(s) {
  const d = new Date(s + "T00:00:00");
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})`;
}

// ---------- 달력 ----------
function renderCal() {
  const y = state.calY, m = state.calM;
  const dates = new Set(state.entries.map(e => e.entry_date));
  $("#calTitle").textContent = `${y}년 ${m+1}월`;
  const g = $("#calGrid"); g.innerHTML = "";
  for (const c of "일월화수목금토") { const d = document.createElement("div"); d.className = "dow"; d.textContent = c; g.appendChild(d); }
  const first = new Date(y, m, 1).getDay(), last = new Date(y, m+1, 0).getDate();
  for (let i = 0; i < first; i++) { const d = document.createElement("span"); d.className = "d muted"; g.appendChild(d); }
  const td = today();
  for (let day = 1; day <= last; day++) {
    const ds = `${y}-${pad(m+1)}-${pad(day)}`;
    const b = document.createElement("button"); b.className = "d"; b.textContent = day;
    if (dates.has(ds)) b.classList.add("has");
    if (ds === td) b.classList.add("today");
    if (ds === state.day) b.classList.add("sel");
    b.onclick = () => {
      if (dates.has(ds)) { state.day = state.day === ds ? null : ds; renderList(); renderCal(); }
      else guard(() => newEntry(ds));
    };
    g.appendChild(b);
  }
}
$("#prevM").onclick = () => { if (--state.calM < 0) { state.calM = 11; state.calY--; } renderCal(); };
$("#nextM").onclick = () => { if (++state.calM > 11) { state.calM = 0; state.calY++; } renderCal(); };

// ---------- 편집기 ----------
function guard(fn) {
  if (state.dirty && !confirm("저장하지 않은 내용이 있어요. 그래도 이동할까요?")) return;
  state.dirty = false; fn(); $("#side").classList.remove("open");
}

function newEntry(date) {
  state.currentId = null;
  renderEditor({ entry_date: date || today(), title: "", content: "", mood: "", weather: "" });
  renderList();
  $("#title").focus();
}

function openEntry(id) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return toast("일기를 찾을 수 없어요.", true);
  state.currentId = id; renderEditor(e); renderList();
}

function chipGroup(options, value, onPick) {
  const wrap = document.createElement("div"); wrap.className = "chips";
  options.forEach(([val, label]) => {
    const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = label;
    c.setAttribute("aria-pressed", String(val === value));
    c.onclick = () => { const on = c.getAttribute("aria-pressed") !== "true";
      wrap.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", "false"));
      c.setAttribute("aria-pressed", String(on)); onPick(on ? val : ""); };
    wrap.appendChild(c);
  });
  return wrap;
}

function renderEditor(e) {
  const s = $("#sheet"); s.innerHTML = "";
  let mood = e.mood, weather = e.weather || "";
  const dirty = () => { state.dirty = true; };

  const meta = document.createElement("div"); meta.className = "meta";
  const date = document.createElement("input"); date.type = "date"; date.value = e.entry_date; date.oninput = dirty;
  const ml = document.createElement("span"); ml.className = "label"; ml.textContent = "기분";
  meta.append(date, ml, chipGroup(MOODS, mood, v => { mood = v; dirty(); }));
  const meta2 = document.createElement("div"); meta2.className = "meta";
  const wl = document.createElement("span"); wl.className = "label"; wl.textContent = "날씨";
  meta2.append(wl, chipGroup(WEATHERS.map(w => [w, w]), weather, v => { weather = v; dirty(); }));

  const title = document.createElement("input"); title.className = "title-in"; title.id = "title";
  title.placeholder = "오늘의 제목"; title.value = e.title; title.maxLength = 200; title.oninput = dirty;
  const content = document.createElement("textarea"); content.className = "content-in";
  content.placeholder = "오늘 있었던 일, 느낀 점을 자유롭게 적어 보세요."; content.value = e.content;
  content.maxLength = 100000; content.oninput = dirty;
  s.append(meta, meta2, title, content);

  const bar = document.createElement("div"); bar.className = "bar";
  const info = document.createElement("span"); info.className = "info";
  info.textContent = e.id ? `작성 ${fmtTs(e.created_at)} · 수정 ${fmtTs(e.updated_at)}` : "새 일기 · Ctrl+S로 저장";
  const btns = document.createElement("div"); btns.style.display = "flex"; btns.style.gap = "8px";

  if (e.id) {
    const del = document.createElement("button"); del.className = "btn danger"; del.textContent = "삭제";
    del.onclick = async () => {
      if (!confirm("이 일기를 삭제할까요? 되돌릴 수 없어요.")) return;
      try { await deleteDoc(doc(entriesCol(), e.id)); state.dirty = false; state.currentId = null;
        toast("삭제했어요."); showWelcome(); await loadAll();
      } catch (err) { toast("삭제 실패: " + (err.code || err.message), true); }
    };
    btns.append(del);
  }
  const save = document.createElement("button"); save.className = "btn primary"; save.textContent = "저장"; save.id = "saveBtn";
  save.onclick = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) return toast("날짜를 선택해 주세요.", true);
    if (!title.value.trim() && !content.value.trim()) return toast("제목이나 내용 중 하나는 입력해 주세요.", true);
    const data = { entry_date: date.value, title: title.value.trim().slice(0, 200),
                   content: content.value, mood, weather, updated_at: serverTimestamp() };
    save.disabled = true;
    try {
      let id = e.id;
      if (id) await updateDoc(doc(entriesCol(), id), data);
      else id = (await addDoc(entriesCol(), { ...data, created_at: serverTimestamp() })).id;
      state.dirty = false; state.currentId = id; toast("저장했어요.");
      await loadAll(); openEntry(id);
    } catch (err) { toast("저장 실패: " + (err.code || err.message), true); save.disabled = false; }
  };
  btns.append(save);
  bar.append(info, btns); s.append(bar);
}

function showWelcome() {
  const s = $("#sheet"); s.innerHTML = "";
  const w = document.createElement("div"); w.className = "welcome";
  const h = document.createElement("h2"); h.textContent = fmtDate(today());
  const p = document.createElement("p"); p.textContent = "왼쪽에서 일기를 고르거나, 오늘의 일기를 새로 써 보세요.";
  const b = document.createElement("button"); b.className = "btn primary"; b.textContent = "오늘 일기 쓰기"; b.onclick = () => newEntry();
  w.append(h, p, b); s.append(w);
}

// ---------- 백업 (내 기기로만 내려받기) ----------
$("#exportBtn").onclick = () => {
  const rows = state.entries.map(({ id, entry_date, title, content, mood, weather, created_at, updated_at }) =>
    ({ id, entry_date, title, content, mood, weather, created_at: fmtTs(created_at), updated_at: fmtTs(updated_at) }));
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `diary-backup-${today().replaceAll("-", "")}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------- 이벤트 ----------
$("#newBtn").onclick = () => guard(() => newEntry());
$("#menuBtn").onclick = () => $("#side").classList.toggle("open");
let qTimer; $("#q").oninput = e => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); renderList(); }, 200); };
$("#clearFilter").onclick = () => { state.day = null; state.q = ""; $("#q").value = ""; renderList(); renderCal(); };
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { const b = $("#saveBtn"); if (b) { e.preventDefault(); b.click(); } }
});
window.addEventListener("beforeunload", e => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });
