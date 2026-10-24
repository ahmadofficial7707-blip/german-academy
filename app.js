// Simple dashboard that links to real, free learning resources
const resources = [
  {
    title: "Deutsche Welle: Nicos Weg (A1 - B1)",
    desc: "The best free video course. Complete A1, A2, and B1 with certificates.",
    url: "https://learngerman.dw.com/en/overview"
  },
  {
    title: "VHS-Lernportal: Free German Courses (A1 - B2)",
    desc: "Official German government platform. 900+ exercises per level.",
    url: "https://www.vhs-lernportal.de/"
  },
  {
    title: "Goethe-Institut: Deutsch für dich (A1 - C2)",
    desc: "Free exercises from the official German cultural institute.",
    url: "https://www.goethe.de/de/spr/ueb.html"
  },
  {
    title: "Easy German (YouTube)",
    desc: "Real street interviews with German & English subtitles.",
    url: "https://www.youtube.com/@EasyGerman"
  }
];

document.addEventListener("DOMContentLoaded", () => {
  const main = document.getElementById("main");
  
  // Render welcome
  main.innerHTML = `
    <h1>Willkommen! Start Learning Today</h1>
    <p class="muted">Click a card below to open the official, free course. Your progress is tracked by them, not this page.</p>
    
    <div class="grid" id="resourceGrid"></div>
    
    <div class="card" style="margin-top: 20px;">
      <h2>Your Daily Plan</h2>
      <ol>
        <li>Open <strong>Nicos Weg A1</strong> and watch 1 video.</li>
        <li>Do 10 minutes of <strong>VHS-Lernportal</strong> exercises.</li>
        <li>Write down 5 new words in a notebook.</li>
      </ol>
    </div>
  `;

  const grid = document.getElementById("resourceGrid");
  
  resources.forEach(res => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${res.title}</h2>
      <p>${res.desc}</p>
      <a href="${res.url}" target="_blank" rel="noopener" class="btn" style="display:inline-block; text-decoration:none; margin-top:10px;">Open Course</a>
    `;
    grid.appendChild(card);
  });
});
