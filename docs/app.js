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

function render(data) {
  const todayISO = todayLocalISO();
  const upcoming = data.collections
    .filter((c) => c.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextCard = document.getElementById("next-card");
  const upcomingList = document.getElementById("upcoming-list");

  if (upcoming.length === 0) {
    nextCard.innerHTML = `<p class="error">No upcoming collections found.</p>`;
    upcomingList.innerHTML = "";
    return;
  }

  const nextDate = upcoming[0].date;
  const sameDay = upcoming.filter((c) => c.date === nextDate);
  const primary = sameDay[0];
  const accent = (data.colours && data.colours[primary.type]) || "#1f6feb";

  nextCard.style.setProperty("--accent", accent);

  const others = sameDay.slice(1).map((c) => c.type).join(" + ");
  nextCard.innerHTML = `
    <p class="bin-type">${primary.type}${others ? " + " + others : ""}</p>
    <p class="bin-date">${formatDayDate(nextDate)}</p>
    <span class="countdown">${countdownLabel(nextDate)}</span>
  `;

  const rest = upcoming.slice(sameDay.length, sameDay.length + 8);
  upcomingList.innerHTML = rest
    .map((c) => {
      const dotColour = (data.colours && data.colours[c.type]) || "#888";
      return `
        <li>
          <span class="dot" style="background:${dotColour}"></span>
          <span class="u-type">${c.type}</span>
          <span class="u-date">${formatShortDate(c.date)}</span>
        </li>
      `;
    })
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
