/* German B2 Academy — app.js
 * Vanilla JS. No dependencies. All data in data/*.json.
 * Progress lives in localStorage under key "gba.state.v1".
 */

const STORAGE_KEY = "gba.state.v1";
const DATA_DIR = "data/";

/* ---------- state ---------- */
const DEFAULT_STATE = {
  version: 1,
  createdAt: null,
  theme: "light",
  level: "A0",
  schedule: 45,                 // minutes/day
  targetMonths: 10,
  completedLessons: [],         // ["A0-L1", ...]
  lessonStartedAt: {},          // {id: iso}
  quizResults: {},              // {quizId: {best: n, total: n, lastAttempt: iso, history:[{score,total,at}]}}
  vocab: {},                    // {wordId: {box, correct, wrong, lastSeen, nextDue}}
  mistakes: [],                 // [{at, lessonId, prompt, yourAnswer, correct, explain}]
  streak: {lastDay: null, count: 0},
  dailyLog: {},                 // {"YYYY-MM-DD": {minutes, tasksDone:[...]}}
  settings: { showTransliteration: true }
};

let STATE = loadState();
let CURRICULUM = null;
let VOCAB = null;
let QUIZZES = null;
let RESOURCES = null;

/* ---------- persistence ---------- */
function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULT_STATE), s);
  } catch (e) {
    console.warn("state load failed", e);
    return structuredClone(DEFAULT_STATE);
  }
}
function saveState(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); }
  catch (e) { console.warn("save failed", e); }
}
function todayStr(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

/* ---------- data loading ---------- */
async function fetchJSON(name){
  const res = await fetch(DATA_DIR + name, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load " + name);
  return res.json();
}
async function loadAllData(){
  [CURRICULUM, VOCAB, QUIZZES, RESOURCES] = await Promise.all([
    fetchJSON("curriculum.json"),
    fetchJSON("vocabulary.json"),
    fetchJSON("quizzes.json"),
    fetchJSON("resources.json"),
  ]);
}

/* ---------- helpers ---------- */
function $(sel, root=document){ return root.querySelector(sel); }
function $$(sel, root=document){ return [...root.querySelectorAll(sel)]; }
function el(tag, props={}, children=[]){
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)){
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}
function esc(s){ return String(s).replace(/[&<>"']/g, c => (
  {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]
)); }
function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

/* ---------- theme ---------- */
function applyTheme(){
  document.documentElement.dataset.theme = STATE.theme;
  $("#themeBtn").textContent = STATE.theme === "dark" ? "☀️" : "🌙";
}
function toggleTheme(){
  STATE.theme = STATE.theme === "dark" ? "light" : "dark";
  saveState(); applyTheme();
}

/* ---------- streak & daily log ---------- */
function logStudyMinutes(mins){
  const day = todayStr();
  const entry = STATE.dailyLog[day] || (STATE.dailyLog[day] = { minutes: 0, tasksDone: [] });
  entry.minutes += mins;
  if (STATE.streak.lastDay !== day){
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    STATE.streak.count = (STATE.streak.lastDay === yesterday) ? STATE.streak.count + 1 : 1;
    STATE.streak.lastDay = day;
  }
  saveState();
  updateLevelPill();
}
function weekMinutes(){
  let total = 0;
  for (let i=0;i<7;i++){
    const d = new Date(Date.now() - i*86400000).toISOString().slice(0,10);
    total += STATE.dailyLog[d]?.minutes || 0;
  }
  return total;
}

/* ---------- level estimation ---------- */
function estimateLevel(){
  const n = STATE.completedLessons.length;
  const quizAvg = Object.values(STATE.quizResults)
    .map(r => (r.best / r.total) || 0);
  const avg = quizAvg.length ? quizAvg.reduce((a,b)=>a+b,0)/quizAvg.length : 0;
  // Very rough guidance, not a certification.
  if (n >= 20 && avg >= 0.8) return "B1~";
  if (n >= 12 && avg >= 0.75) return "A2~";
  if (n >= 5  && avg >= 0.7)  return "A1~";
  if (n >= 1)                  return "A1";
  return "A0";
}
function updateLevelPill(){
  STATE.level = estimateLevel();
  $("#levelPill").textContent = STATE.level;
}

/* ---------- SRS (Leitner boxes 1-5) ---------- */
const SRS_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }; // days
function vocabState(id){
  if (!STATE.vocab[id]) STATE.vocab[id] = { box: 1, correct: 0, wrong: 0, lastSeen: null, nextDue: null };
  return STATE.vocab[id];
}
function gradeVocab(id, correct){
  const v = vocabState(id);
  if (correct){
    v.correct++;
    v.box = Math.min(5, v.box + 1);
  } else {
    v.wrong++;
    v.box = 1;
  }
  v.lastSeen = new Date().toISOString();
  const days = SRS_INTERVALS[v.box];
  v.nextDue = new Date(Date.now() + days*86400000).toISOString().slice(0,10);
  saveState();
}
function vocabDue(now=new Date()){
  const today = now.toISOString().slice(0,10);
  return VOCAB.words.filter(w => {
    const v = STATE.vocab[w.id];
    if (!v) return true;                        // new word
    if (!v.nextDue) return true;
    return v.nextDue <= today;                  // due today or overdue
  });
}

/* ---------- view router ---------- */
const VIEWS = {
  dashboard: renderDashboard,
  roadmap:   renderRoadmap,
  lesson:    renderLessonView,
  vocab:     renderVocab,
  quiz:      renderQuizIndex,
  mistakes:  renderMistakes,
  resources: renderResources,
  progress:  renderProgress,
  settings:  renderSettings,
};

function setActiveNav(name){
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === name));
}
function navigate(view, params={}){
  setActiveNav(view);
  const main = $("#main");
  main.innerHTML = "";
  main.scrollTop = 0;
  window.scrollTo({top:0});
  closeSidebar();
  const fn = VIEWS[view] || renderDashboard;
  fn(main, params);
}

function closeSidebar(){
  $("#sidebar").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
}

/* ---------- view: dashboard ---------- */
function renderDashboard(main){
  main.append(el("h1", {}, ["Dashboard"]));
  main.append(el("p", {className:"muted"},
    ["Welcome. Today's plan is generated from your progress, due vocabulary, and remaining lessons."]));

  // next lesson
  const next = CURRICULUM.lessons.find(l => !STATE.completedLessons.includes(l.id));
  const dueVocab = vocabDue().length;
  const today = STATE.dailyLog[todayStr()] || {minutes:0};
  const goal = STATE.schedule;

  const grid = el("div", {className:"grid"});
  grid.append(card("Continue learning", [
    next ? el("p", {}, [
      el("strong", {}, [next.title]),
      el("br"),
      el("span", {className:"muted"}, [next.level + " · " + next.duration + " min"])
    ]) : el("p", {}, ["You've completed every available lesson. Add more to data/curriculum.json."]),
    next ? el("button", {className:"btn", onclick:() => navigate("lesson", {id: next.id})},
      ["Start lesson"]) : null
  ]));
  grid.append(card("Vocabulary due", [
    el("p", {}, [String(dueVocab) + " word(s) need review today."]),
    el("button", {className:"btn secondary", onclick:() => navigate("vocab")},
      ["Review now"])
  ]));
  grid.append(card("Today", [
    el("p", {}, [today.minutes + " / " + goal + " min studied"]),
    progressBar(goal ? today.minutes/goal : 0),
    el("p", {className:"muted"}, ["Streak: " + STATE.streak.count + " day(s) · Week: " + weekMinutes() + " min"])
  ]));
  main.append(grid);

  // 7-day quick plan
  main.append(el("div", {className:"card"}, [
    el("h2", {}, ["Your week"]),
    el("ul", {className:"lesson-list"}, [
      planRow("Review vocabulary", dueVocab + " cards due", () => navigate("vocab")),
      next ? planRow("New lesson", next.title, () => navigate("lesson", {id: next.id})) : null,
      planRow("Quiz", "Take any quiz to measure progress", () => navigate("quiz")),
      planRow("Mistake notebook", STATE.mistakes.length + " recorded mistakes", () => navigate("mistakes")),
      planRow("Listening (external)", "Open DW Nicos Weg for 10 minutes", () => window.open("https://learngerman.dw.com/", "_blank")),
    ].filter(Boolean))
  ]));

  main.append(el("p", {className:"muted"},
    ["Level shown (" + STATE.level + ") is a heuristic based on completed lessons and quiz scores. Not an official certificate."]));
}

function card(title, children){
  const node = el("div", {className:"card"});
  node.append(el("h2", {}, [title]));
  for (const c of children) if (c) node.append(c);
  return node;
}
function planRow(title, detail, onClick){
  const li = el("li");
  li.append(el("div", {}, [el("strong", {}, [title]), el("div", {className:"meta"}, [detail])]));
  li.append(el("button", {className:"btn secondary", onclick: onClick}, ["Open"]));
  return li;
}
function progressBar(frac){
  frac = Math.max(0, Math.min(1, frac || 0));
  const wrap = el("div", {className:"progress-bar"});
  const fill = el("span");
  fill.style.width = (frac*100).toFixed(1) + "%";
  wrap.append(fill);
  return wrap;
}

/* ---------- view: roadmap ---------- */
function renderRoadmap(main){
  main.append(el("h1", {}, ["Roadmap: A0 → B2"]));
  main.append(el("p", {className:"muted"},
    ["Modules are described for each level. Fully written lessons are marked with a ▶ open button."]));

  for (const level of CURRICULUM.levels){
    const lessonsHere = CURRICULUM.lessons.filter(l => l.level === level.id);
    const done = lessonsHere.filter(l => STATE.completedLessons.includes(l.id)).length;
    const card = el("div", {className:"card"});
    card.append(el("h2", {}, [level.title]));
    card.append(el("p", {className:"muted"}, [level.description]));
    card.append(progressBar(lessonsHere.length ? done/lessonsHere.length : 0));
    card.append(el("p", {className:"muted"}, [
      done + " / " + lessonsHere.length + " written lessons complete"
    ]));
    card.append(el("h3", {}, ["Planned modules"]));
    const ul = el("ul");
    for (const m of level.modules) ul.append(el("li", {}, [m]));
    card.append(ul);

    if (lessonsHere.length){
      card.append(el("h3", {}, ["Written lessons"]));
      const list = el("ul", {className:"lesson-list"});
      for (const l of lessonsHere){
        const li = el("li");
        const doneMark = STATE.completedLessons.includes(l.id) ? "✅ " : "";
        li.append(el("div", {}, [
          el("strong", {}, [doneMark + l.title]),
          el("div", {className:"meta"}, [l.level + " · " + l.duration + " min"])
        ]));
        li.append(el("button", {className:"btn secondary",
          onclick: () => navigate("lesson", {id: l.id})}, ["Open"]));
        list.append(li);
      }
      card.append(list);
    } else {
      card.append(el("p", {className:"muted"}, ["No lessons written yet for this level. Add them in data/curriculum.json using the same schema."]));
    }
    main.append(card);
  }
}

/* ---------- view: lesson ---------- */
function renderLessonView(main, params){
  const lessons = CURRICULUM.lessons;
  const id = params?.id || lessons.find(l => !STATE.completedLessons.includes(l.id))?.id || lessons[0]?.id;
  const lesson = lessons.find(l => l.id === id);
  if (!lesson){
    main.append(el("p", {}, ["No lesson found. Add lessons to data/curriculum.json."]));
    return;
  }

  main.append(el("h1", {}, [lesson.title]));
  main.append(el("div", {className:"tag-row"}, [
    el("span", {className:"chip"}, [lesson.level]),
    el("span", {className:"chip"}, [lesson.duration + " min"]),
    STATE.completedLessons.includes(lesson.id) ? el("span", {className:"chip"}, ["✅ completed"]) : null
  ].filter(Boolean)));

  // prerequisites & objectives
  if (lesson.prerequisites) main.append(el("p", {className:"muted"}, ["Prerequisite: " + lesson.prerequisites]));
  if (lesson.objectives?.length){
    const obj = el("div", {className:"card"});
    obj.append(el("h2", {}, ["Learning objectives"]));
    const ul = el("ul");
    for (const o of lesson.objectives) ul.append(el("li", {}, [o]));
    obj.append(ul);
    main.append(obj);
  }

  // main html body
  const body = el("div", {className:"card"});
  body.innerHTML = lesson.html;
  main.append(body);

  // quiz button
  if (lesson.quizId){
    main.append(el("div", {className:"row"},
      [el("button", {className:"btn",
        onclick: () => navigate("quiz", {id: lesson.quizId})}, ["Take quiz"])]));
  }

  // complete
  const isDone = STATE.completedLessons.includes(lesson.id);
  main.append(el("div", {className:"card"}, [
    el("h2", {}, ["Completion checklist"]),
    checklist("mark-read", "I read the German, English and Urdu explanations"),
    checklist("mark-vocab", "I reviewed the vocabulary table"),
    checklist("mark-quiz", lesson.quizId ? "I completed the quiz" : "No quiz required"),
    el("div", {className:"row"},
      isDone
        ? el("span", {className:"chip"}, ["Marked complete"])
        : el("button", {className:"btn", onclick: () => {
            if (!STATE.completedLessons.includes(lesson.id)){
              STATE.completedLessons.push(lesson.id);
              logStudyMinutes(lesson.duration);
              saveState();
            }
            updateLevelPill();
            navigate("lesson", {id: lesson.id});
          }}, ["Mark lesson complete"])
    )
  ]));

  // next lesson
  const idx = lessons.indexOf(lesson);
  const next = lessons[idx+1];
  if (next){
    main.append(el("div", {className:"card"}, [
      el("h2", {}, ["Next up"]),
      el("p", {}, [next.title]),
      el("button", {className:"btn secondary", onclick: () => navigate("lesson", {id: next.id})},
        ["Go to next lesson"])
    ]));
  }
}
function checklist(key, label){
  const id = "chk-" + key;
  const wrap = el("label", {className:"field"});
  wrap.style.display = "flex"; wrap.style.alignItems = "center"; wrap.style.gap = "8px";
  const input = el("input", {type:"checkbox", id});
  input.style.width = "auto";
  wrap.append(input, el("span", {}, [label]));
  return wrap;
}

/* ---------- view: vocab (SRS) ---------- */
function renderVocab(main, params){
  main.append(el("h1", {}, ["Vocabulary — spaced repetition"]));
  const mode = params?.mode || "de-en"; // de-en | en-de | de-ur
  const due = shuffle(vocabDue());

  main.append(el("div", {className:"row"}, [
    modeBtn("German → English", "de-en"),
    modeBtn("English → German", "en-de"),
    modeBtn("German → Urdu", "de-ur"),
  ]));

  const stats = el("p", {className:"muted"}, [
    "New/learning: " + VOCAB.words.filter(w => !STATE.vocab[w.id] || STATE.vocab[w.id].box < 5).length +
    " · Mastered (box 5): " + VOCAB.words.filter(w => STATE.vocab[w.id]?.box === 5).length +
    " · Due now: " + due.length
  ]);
  main.append(stats);

  if (!due.length){
    main.append(el("div", {className:"card"}, [
      el("p", {}, ["No cards due. Come back tomorrow or reset SRS in Settings."])
    ]));
    return;
  }

  let i = 0;
  const stage = el("div");
  main.append(stage);

  function draw(){
    stage.innerHTML = "";
    if (i >= due.length){
      stage.append(el("div", {className:"card"}, [
        el("h2", {}, ["Session complete"]),
        el("p", {}, ["You reviewed " + due.length + " card(s)."]),
        el("button", {className:"btn", onclick: () => navigate("vocab", {mode})}, ["New session"])
      ]));
      return;
    }
    const w = due[i];
    const box = vocabState(w.id);
    stage.append(el("p", {className:"muted"}, [
      "Card " + (i+1) + " / " + due.length + " · Box " + box.box + "/5"
    ]));

    const fc = el("div", {className:"flashcard", onclick: e => {
      if (!e.target.closest("button")) fc.classList.toggle("flipped");
    }});
    const inner = el("div", {className:"inner"});
    const front = el("div", {className:"face"});
    const back = el("div", {className:"face back"});

    if (mode === "de-en"){
      front.append(el("div", {className:"de"}, [w.article ? w.article + " " : "", w.word]));
      front.append(el("div", {className:"muted"}, ["click to reveal"]));
      back.append(el("div", {}, [w.english]));
      back.append(el("div", {className:"muted"}, [w.urdu]));
    } else if (mode === "en-de"){
      front.append(el("div", {className:"de"}, [w.english]));
      front.append(el("div", {className:"muted"}, ["click to reveal"]));
      back.append(el("div", {}, [(w.article ? w.article + " " : "") + w.word]));
      back.append(el("div", {className:"muted"}, [w.urdu]));
    } else { // de-ur
      front.append(el("div", {className:"de"}, [w.article ? w.article + " " : "", w.word]));
      front.append(el("div", {className:"muted"}, ["click to reveal Urdu"]));
      back.append(el("div", {className:"urdu"}, [w.urdu]));
      back.append(el("div", {className:"muted"}, [w.english]));
    }
    inner.append(front, back);
    fc.append(inner);
    stage.append(fc);

    if (w.example){
      stage.append(el("div", {className:"card"}, [
        el("p", {className:"de"}, [w.example]),
        el("p", {className:"en"}, [w.exampleEn || ""]),
      ]));
    }

    stage.append
