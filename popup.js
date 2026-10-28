const DEFAULTS = { redSub: true, hideThumbText: true, oldLayout: true, hideJoinAndThanks: true, sharpButtons: true, iconOnly: true, customRules: [] };

function renderRules(rules) {
  const ul = document.getElementById("rules");
  ul.innerHTML = "";
  rules.forEach((r, i) => {
    const li = document.createElement("li");
    const txt = document.createElement("span");
    txt.textContent = r;
    txt.style.flex = "1";
    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Show this again";
    del.onclick = () => {
      const next = rules.filter((_, j) => j !== i);
      chrome.storage.sync.set({ customRules: next }, () => renderRules(next));
    };
    li.append(txt, del);
    ul.appendChild(li);
  });
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  for (const key of ["redSub", "oldLayout", "hideJoinAndThanks", "sharpButtons", "iconOnly", "hideThumbText"]) {
    const box = document.getElementById(key);
    box.checked = !!s[key];
    box.onchange = () => chrome.storage.sync.set({ [key]: box.checked });
  }
  renderRules(s.customRules || []);
});

document.getElementById("pick").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/youtube\.com/.test(tab.url || "")) {
    alert("Open a YouTube page first.");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "ytc-start-pick" });
  window.close();
};