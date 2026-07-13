const DATA_URL = "data/collections.json";
const STALE_AFTER_DAYS = 7;

function todayLocalISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDayDate(iso) {
  const date = parseLocalDate(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShortDate(iso) {
  const date = parseLocalDate(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function countdownLabel(iso) {
  const today = parseLocalDate(todayLocalISO());
  const target = parseLocalDate(iso);
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1) return `In ${diffDays} days`;
  return "Overdue";
}

// Collapses a sorted flat list of {date, type} entries into date groups,
// so same-day collections (e.g. General Waste + Recycling) stay together.
function groupByDate(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) {
      last.items.push(item);
    } else {
      groups.push({ date: item.date, items: [item] });
    }
  }
  return groups;
}

function collectionRowHTML(item, colours) {
  const dotColour = (colours && colours[item.type]) || "#888";
  return `
    <li>
      <span class="dot" style="background:${dotColour}"></span>
      <span class="u-type">${item.type}</span>
      <span class="u-date">${formatShortDate(item.date)}</span>
    </li>
  `;
}

function render(data) {
  const todayISO = todayLocalISO();
  const upcoming = data.collections
    .filter((c) => c.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextCard = document.getElementById("next-card");
  const thenSection = document.getElementById("then-section");
  const thenCard = document.getElementById("then-card");
  const upcomingList = document.getElementById("upcoming-list");

  const groups = groupByDate(upcoming);

  if (groups.length === 0) {
    nextCard.innerHTML = `<p class="error">No upcoming collections found.</p>`;
    thenSection.hidden = true;
    upcomingList.innerHTML = "";
    return;
  }

  const nextGroup = groups[0];
  const primary = nextGroup.items[0];
  const accent = (data.colours && data.colours[primary.type]) || "#1f6feb";

  nextCard.style.setProperty("--accent", accent);

  const others = nextGroup.items.slice(1).map((c) => c.type).join(" + ");
  nextCard.innerHTML = `
    <p class="bin-type">${primary.type}${others ? " + " + others : ""}</p>
    <p class="bin-date">${formatDayDate(nextGroup.date)}</p>
    <span class="countdown">${countdownLabel(nextGroup.date)}</span>
  `;

  const thenGroup = groups[1];
  thenSection.hidden = !thenGroup;
  if (thenGroup) {
    const thenPrimary = thenGroup.items[0];
    const thenAccent = (data.colours && data.colours[thenPrimary.type]) || "#1f6feb";
    const thenOthers = thenGroup.items.slice(1).map((c) => c.type).join(" + ");

    thenCard.style.setProperty("--accent", thenAccent);
    thenCard.innerHTML = `
      <div>
        <p class="then-type">${thenPrimary.type}${thenOthers ? " + " + thenOthers : ""}</p>
        <p class="then-date">${formatShortDate(thenGroup.date)}</p>
      </div>
      <span class="then-countdown">${countdownLabel(thenGroup.date)}</span>
    `;
  } else {
    thenCard.innerHTML = "";
  }

  const rest = groups.slice(2).flatMap((g) => g.items).slice(0, 8);
  upcomingList.innerHTML = rest
    .map((c) => collectionRowHTML(c, data.colours))
    .join("");

  const updatedDate = new Date(data.updated);
  document.getElementById("updated-text").textContent =
    "Updated " +
    updatedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    ", " +
    updatedDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const ageDays = (Date.now() - updatedDate.getTime()) / 86400000;
  document.getElementById("stale-warning").hidden = ageDays < STALE_AFTER_DAYS;
}

async function load() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    render(data);
  } catch (err) {
    document.getElementById("next-card").innerHTML =
      `<p class="error">Couldn't load the schedule. ${err.message}</p>`;
  }
}

load();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

const MIN_SPINNER_MS = 400;

// Runs `fn` but ensures at least `minMs` passes first, so a loading spinner
// never flashes too briefly to register.
async function withMinDuration(fn, minMs) {
  const started = Date.now();
  const result = await fn();
  const elapsed = Date.now() - started;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
  return result;
}

// --- Refresh button ---
(function setupRefreshButton() {
  const btn = document.getElementById("refresh-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("spinning");
    await withMinDuration(load, MIN_SPINNER_MS);
    btn.classList.remove("spinning");
    btn.disabled = false;
  });
})();

// --- Pull to refresh ---
// Installed/standalone PWAs don't reliably get the browser's native
// pull-to-refresh, so this reimplements the gesture by hand.
(function setupPullToRefresh() {
  const indicator = document.getElementById("ptr-indicator");
  const arrow = indicator.querySelector(".ptr-arrow");
  const THRESHOLD = 70;
  const MAX_PULL = 110;

  let startY = 0;
  let distance = 0;
  let pulling = false;
  let refreshing = false;

  function setPull(px) {
    distance = Math.max(0, Math.min(px, MAX_PULL));
    const progress = Math.min(distance / THRESHOLD, 1);
    indicator.style.transform = `translateY(${distance}px)`;
    indicator.style.opacity = String(progress);
    // Arrow points down while pulling, flips to point up once past the
    // threshold (i.e. "release to refresh").
    arrow.style.transform = `rotate(${progress * 180}deg)`;
  }

  function resetPull() {
    indicator.style.transition = "transform 0.25s ease, opacity 0.25s ease";
    setPull(0);
    setTimeout(() => {
      indicator.style.transition = "";
    }, 250);
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      if (refreshing || window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!pulling || refreshing) return;
      const diff = e.touches[0].clientY - startY;
      if (diff <= 0 || window.scrollY > 0) {
        pulling = false;
        setPull(0);
        return;
      }
      e.preventDefault();
      setPull(diff * 0.5);
    },
    { passive: false }
  );

  document.addEventListener("touchend", async () => {
    if (!pulling || refreshing) {
      pulling = false;
      return;
    }
    pulling = false;

    if (distance < THRESHOLD) {
      resetPull();
      return;
    }

    refreshing = true;
    indicator.style.transition = "transform 0.2s ease";
    indicator.style.transform = `translateY(${THRESHOLD}px)`;
    indicator.style.opacity = "1";
    arrow.style.transform = "";
    indicator.classList.add("refreshing");

    await withMinDuration(load, MIN_SPINNER_MS);

    indicator.classList.remove("refreshing");
    refreshing = false;
    resetPull();
  });
})();
