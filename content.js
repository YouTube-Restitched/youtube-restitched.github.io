// YouTube Classic Tweaks - content script
(() => {
  const DEFAULTS = { redSub: true, hideThumbText: true, oldLayout: true, hideJoinAndThanks: true, sharpButtons: true, iconOnly: true, customRules: [] };
  let settings = { ...DEFAULTS };
  let customStyleEl = null;

  // ---------- apply settings ----------
  function apply() {
    const root = document.documentElement;
    root.classList.toggle("ytc-redsub", !!settings.redSub);
    root.classList.toggle("ytc-notext", !!settings.hideThumbText);
    root.classList.toggle("ytc-oldlayout", !!settings.oldLayout);
    root.classList.toggle("ytc-nojointhx", !!settings.hideJoinAndThanks);
    root.classList.toggle("ytc-sharp", !!settings.sharpButtons);
    root.classList.toggle("ytc-icononly", !!settings.iconOnly);

    if (!customStyleEl) {
      customStyleEl = document.createElement("style");
      customStyleEl.id = "ytc-custom-rules";
      (document.head || root).appendChild(customStyleEl);
    }
    const rules = (settings.customRules || []).filter(Boolean);
    customStyleEl.textContent =
      settings.hideThumbText && rules.length
        ? rules.map((r) => `${r} { display: none !important; }`).join("\n")
        : "";
    if (settings.redSub) tagSubButtons();
    if (settings.hideThumbText) tagNewBadges();
    updateInfoLine();
    tagJoinAndThanks();
    extractOverflowButtons();
  }

  function load() {
    chrome.storage.sync.get(DEFAULTS, (s) => {
      settings = { ...DEFAULTS, ...s };
      apply();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const k of Object.keys(changes)) settings[k] = changes[k].newValue;
    apply();
  });

  // ---------- find subscribe buttons & mark their state ----------
  const SUB_CONTAINERS = [
    "#subscribe-button",
    "ytd-subscribe-button-renderer",
    "yt-subscribe-button-view-model",
    "[class*='subscribe-button' i]",
  ].join(",");

  function isSubscribed(container, btn) {
    const cls = btn.className || "";
    if (/--filled/.test(cls)) return false;
    if (/--tonal/.test(cls)) return true;
    const sub = container.getAttribute("subscribed");
    if (sub !== null && sub !== "false") return true;
    const icon = btn.querySelector(".yt-spec-button-shape-next__icon svg, .yt-spec-button-shape-next__icon yt-icon");
    if (icon && icon.getBoundingClientRect().width > 0) return true;
    return false;
  }

  function tagSubButtons() {
    if (!settings.redSub) return;
    document.querySelectorAll(SUB_CONTAINERS).forEach((c) => {
      const btn = c.querySelector("button");
      if (!btn || btn.closest("#ytc-pick-banner")) return;
      const state = isSubscribed(c, btn) ? "1" : "0";
      if (btn.dataset.ytcSub !== state) btn.dataset.ytcSub = state;
    });
  }

  // ---------- hide the "Új" / "New" badge on thumbnails ----------
  const NEW_WORDS = new Set([
    "új", "new", "neu", "nouveau", "nouvelle", "nuevo", "nueva", "nuovo",
    "novo", "nova", "nowy", "nowe", "nové", "nový", "nou", "nieuw", "ny",
    "nyt", "uusi", "yeni", "новое", "новый", "нове", "jaunums", "naujas",
  ]);
  const THUMBS =
    "ytd-thumbnail, yt-thumbnail-view-model, a#thumbnail, ytd-playlist-thumbnail, " +
    "yt-lockup-view-model .yt-lockup-view-model__content-image, [class*='thumbnail' i]";

  function tagNewBadges() {
    if (!settings.hideThumbText) return;
    document.querySelectorAll(THUMBS).forEach((thumb) => {
      thumb.querySelectorAll("div, span, p, badge-shape, yt-badge-shape").forEach((el) => {
        if (el.dataset.ytcThumbtext === "1") return;
        const txt = (el.textContent || "").trim().toLowerCase();
        if (!txt || txt.length > 12 || !NEW_WORDS.has(txt)) return;
        const badge = el.closest("[class*='badge' i]");
        const target = badge && thumb.contains(badge) && badge !== thumb ? badge : el;
        target.dataset.ytcThumbtext = "1";
      });
    });
  }

  // ---------- classic layout: views + date line next to the buttons ----------
  function updateInfoLine() {
    const root = document.documentElement;
    const topRow = document.querySelector("ytd-watch-metadata #top-row");
    let line = document.getElementById("ytc-info");
    if (!settings.oldLayout || !topRow) {
      line?.remove();
      root.classList.remove("ytc-infomoved");
      return;
    }
    if (!line || line.parentElement !== topRow) {
      line?.remove();
      line = document.createElement("div");
      line.id = "ytc-info";
      topRow.prepend(line);
    }
    const tip = document.querySelector("ytd-watch-metadata ytd-watch-info-text tp-yt-paper-tooltip #tooltip");
    const info = document.querySelector("ytd-watch-metadata ytd-watch-info-text #info");
    const text = ((tip && tip.textContent.trim()) || (info && info.textContent.trim()) || "")
      .replace(/\s+/g, " ");
    if (line.textContent !== text) line.textContent = text;
    root.classList.toggle("ytc-infomoved", !!text);
  }

  // ---------- hide Join and Thanks ("Köszönet" / "Csatlakozás") buttons ----------
  const JOIN_THX_WORDS = [
    "thanks", "super thanks", "köszönet", "danke", "merci", "gracias", "grazie",
    "obrigado", "dziękuję", "děkuji", "ďakujem", "mulțumesc", "спасибо", "dank",
    "join", "csatlakozás", "mitglied werden", "unirse", "unisciti", "se abonner"
  ];
  function tagJoinAndThanks() {
    if (!settings.hideJoinAndThanks) return;
    document.querySelectorAll("ytd-watch-metadata #actions button, ytd-watch-metadata #owner button").forEach((btn) => {
      const label = ((btn.getAttribute("aria-label") || "") + " " + btn.textContent)
        .trim().toLowerCase().replace(/\s+/g, " ");
      if (!JOIN_THX_WORDS.some((w) => label.includes(w))) return;
      const box = btn.closest("yt-button-view-model, ytd-button-renderer, #sponsor-button") || btn;
      box.dataset.ytcJointhx = "1";
    });
  }

  // ---------- Extract overflow buttons from ⋯ menu when iconOnly is active ----------
  function extractOverflowButtons() {
    if (!settings.iconOnly) return;
    const menuRenderer = document.querySelector("ytd-watch-metadata #actions ytd-menu-renderer");
    const computedRow = document.querySelector("ytd-watch-metadata #actions #top-level-buttons-computed");
    if (!menuRenderer || !computedRow) return;

    const items = menuRenderer.querySelectorAll("ytd-button-renderer, yt-button-view-model, toggle-button-view-model");
    items.forEach((item) => {
      if (!item.dataset.ytcExtracted) {
        item.dataset.ytcExtracted = "1";
        computedRow.appendChild(item);
      }
    });
  }

  let scheduled = false;
  function scheduleTag() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tagSubButtons();
      tagNewBadges();
      updateInfoLine();
      tagJoinAndThanks();
      extractOverflowButtons();
    });
  }

  function startObserver() {
    new MutationObserver(scheduleTag).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["subscribed", "class", "aria-label"],
      characterData: true,
    });
    tagSubButtons();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }

  // ---------- element picker ----------
  let picking = false;
  let hovered = null;
  let banner = null;

  const THUMB_ROOTS =
    "ytd-thumbnail, yt-thumbnail-view-model, a#thumbnail, ytd-playlist-thumbnail, yt-lockup-view-model";

  function cssEscapeClass(c) {
    return window.CSS && CSS.escape ? CSS.escape(c) : c.replace(/([^\w-])/g, "\\$1");
  }

  function buildSelector(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      const tag = node.tagName.toLowerCase();
      const classes = [...node.classList]
        .filter((c) => !c.startsWith("ytc-") && !/^style-scope$/.test(c))
        .slice(0, 3)
        .map((c) => "." + cssEscapeClass(c))
        .join("");
      parts.unshift(tag + classes);
      if (classes) break;
      node = node.parentElement;
      depth++;
    }
    const thumbRoot = el.closest(THUMB_ROOTS);
    const prefix = thumbRoot ? thumbRoot.tagName.toLowerCase() + " " : "";
    return prefix + parts.join(" > ");
  }

  function onMove(e) {
    const el = e.target;
    if (hovered && hovered !== el) hovered.classList.remove("ytc-pick-hover");
    hovered = el;
    hovered.classList.add("ytc-pick-hover");
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const el = e.target;
    el.classList.remove("ytc-pick-hover");
    const selector = buildSelector(el);
    stopPicking();
    chrome.storage.sync.get(DEFAULTS, (s) => {
      const rules = new Set(s.customRules || []);
      rules.add(selector);
      chrome.storage.sync.set({ customRules: [...rules], hideThumbText: true });
    });
  }

  function onKey(e) {
    if (e.key === "Escape") stopPicking();
  }

  function startPicking() {
    if (picking) return;
    picking = true;
    banner = document.createElement("div");
    banner.id = "ytc-pick-banner";
    banner.textContent = "Click the text on a thumbnail to hide it everywhere • Esc to cancel";
    document.body.appendChild(banner);
    document.addEventListener("mouseover", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  }

  function stopPicking() {
    picking = false;
    if (hovered) hovered.classList.remove("ytc-pick-hover");
    hovered = null;
    banner?.remove();
    banner = null;
    document.removeEventListener("mouseover", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "ytc-start-pick") startPicking();
  });

  load();
  document.addEventListener("yt-navigate-finish", apply);
})();