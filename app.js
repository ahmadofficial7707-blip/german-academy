const STORAGE_KEY = "gba.state.v1";
let STATE = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  theme: "light", level: "A0", completedLessons: [], vocab: {}, quizResults: {}, dailyLog: {}, streak: {count:0, lastDay:null}
};
let CURRICULUM = null;

document.addEventListener("DOMContentLoaded", async () => {
  document.documentElement.dataset.theme = STATE.theme;
  document.getElementById("themeBtn").textContent = STATE.theme === "dark" ? "☀️" : "🌙";
  
  // Load data
  try {
    const res = await fetch("data/curriculum.json");
    CURRICULUM = await res.json();
  } catch (e) {
    console.error("Data failed to load", e);
  }

  // Handle navigation clicks
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      const view = e.target.dataset.view;
      if (view === "dashboard") renderDashboard();
      else document.getElementById("main").innerHTML = "<h1>Coming Soon</h1><p>This section is being built.</p>";
    });
  });

  document.getElementById("themeBtn").addEventListener("click", () => {
    STATE.theme = STATE.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = STATE.theme;
    document.getElementById("themeBtn").textContent = STATE.theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  });

  renderDashboard();
});

function renderDashboard() {
  const main = document.getElementById("main");
  let next = CURRICULUM ? CURRICULUM.lessons[0] : null;
  
  main.innerHTML = `
    <h1>Dashboard</h1>
    <p class="muted">Welcome. Today's plan is ready.</p>
    
    <div class="grid">
      <div class="card">
        <h2>Continue learning</h2>
        <p><strong>${next ? next.title : 'Loading...'}</strong><br><span class="muted">${next ? next.level + ' · ' + next.duration + ' min' : ''}</span></p>
        <button class="btn" onclick="startLesson()">Start lesson</button>
      </div>
      <div class="card">
        <h2>Today</h2>
        <p>0 / 45 min studied</p>
        <div class="progress-bar"><span style="width:0%"></span></div>
      </div>
    </div>
  `;
}

window.startLesson = function() {
  if (!CURRICULUM || !CURRICULUM.lessons.length) return alert("Data loading...");
  const lesson = CURRICULUM.lessons[0];
  const main = document.getElementById("main");
  main.innerHTML = `
    <h1>${lesson.title}</h1>
    <div class="card">${lesson.html}</div>
    <button class="btn" onclick="alert('Lesson complete! Good job.')">Mark Lesson Complete</button>
  `;
};
