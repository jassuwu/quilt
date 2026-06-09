import { ContributionsError, fetchContributions } from "../lib/contributions";
import { hexForLevel } from "../lib/levels";
import { mergeContributions } from "../lib/merge";
import type { AccountContributions, Quilt } from "../lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CELL = 11;
const STEP = 14; // cell + gap
const TOP = 18; // room for month labels
const LEFT = 26; // room for weekday labels

const form = document.querySelector<HTMLFormElement>("#quilt-form");
const input = document.querySelector<HTMLInputElement>("#quilt-input");
const status = document.querySelector<HTMLParagraphElement>("#quilt-status");
const result = document.querySelector<HTMLElement>("#quilt-result");
const statsEl = document.querySelector<HTMLElement>("#quilt-stats");
const graphEl = document.querySelector<HTMLElement>("#quilt-graph");

function parseUsernames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const name = part.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

function setStatus(message: string, isError = false): void {
  if (!status) return;
  if (!message) {
    status.classList.add("hidden");
    status.textContent = "";
    return;
  }
  status.textContent = message;
  status.classList.remove("hidden");
  status.classList.toggle("text-stitch", isError);
  status.classList.toggle("text-muted", !isError);
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function renderStats(quilt: Quilt): void {
  if (!statsEl) return;
  const stat = (value: string, label: string) =>
    `<div class="flex flex-col gap-1">
      <dd class="nums text-3xl font-semibold text-text">${value}</dd>
      <dt class="text-sm text-muted">${label}</dt>
    </div>`;
  const n = (v: number) => v.toLocaleString("en-US");
  statsEl.innerHTML = [
    stat(n(quilt.total), "contributions"),
    stat(n(quilt.usernames.length), quilt.usernames.length === 1 ? "account" : "accounts"),
    stat(`${n(quilt.longestStreak)}`, "longest streak"),
    stat(`${n(quilt.currentStreak)}`, "current streak"),
  ].join("");
}

function renderGraph(quilt: Quilt): string {
  if (!quilt.days.length) return "";
  const first = utcDate(quilt.from);
  const firstSunday = new Date(first);
  firstSunday.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const colOf = (d: Date) => Math.floor((d.getTime() - firstSunday.getTime()) / (7 * 86_400_000));
  const numCols = colOf(utcDate(quilt.to)) + 1;
  const width = LEFT + numCols * STEP;
  const height = TOP + 7 * STEP;

  const cells = quilt.days
    .map((day) => {
      const d = utcDate(day.date);
      const x = LEFT + colOf(d) * STEP;
      const y = TOP + d.getUTCDay() * STEP;
      const noun = day.count === 1 ? "contribution" : "contributions";
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${hexForLevel(
        day.level,
      )}"><title>${day.count} ${noun} on ${day.date}</title></rect>`;
    })
    .join("");

  const months: string[] = [];
  let prevMonth = -1;
  for (let col = 0; col < numCols; col++) {
    const weekStart = new Date(firstSunday);
    weekStart.setUTCDate(firstSunday.getUTCDate() + col * 7);
    const m = weekStart.getUTCMonth();
    if (m !== prevMonth) {
      months.push(
        `<text x="${LEFT + col * STEP}" y="${TOP - 6}" fill="#7d8590" font-size="10">${MONTHS[m]}</text>`,
      );
      prevMonth = m;
    }
  }

  const weekdays = [
    [1, "Mon"],
    [3, "Wed"],
    [5, "Fri"],
  ]
    .map(
      ([row, label]) =>
        `<text x="0" y="${TOP + (row as number) * STEP + 9}" fill="#7d8590" font-size="10">${label}</text>`,
    )
    .join("");

  const label = `Merged contribution graph for ${quilt.usernames.join(", ")}`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" style="font-family:var(--font-sans)">${months.join("")}${weekdays}${cells}</svg>`;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof ContributionsError) return reason.message;
  return "something went wrong";
}

function updateUrl(usernames: string[]): void {
  const url = new URL(location.href);
  if (usernames.length) url.searchParams.set("u", usernames.join(","));
  else url.searchParams.delete("u");
  history.replaceState(null, "", url);
}

async function run(usernames: string[]): Promise<void> {
  if (!usernames.length) {
    setStatus("Add at least one GitHub username.", true);
    return;
  }
  setStatus(`Stitching ${usernames.length} account${usernames.length === 1 ? "" : "s"}…`);

  const settled = await Promise.allSettled(usernames.map((u) => fetchContributions(u)));
  const sources: AccountContributions[] = [];
  const errors: { username: string; message: string }[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") sources.push(outcome.value);
    else errors.push({ username: usernames[i], message: errorMessage(outcome.reason) });
  });

  if (!sources.length) {
    setStatus(errors.map((e) => `${e.username}: ${e.message}`).join(" · "), true);
    return;
  }

  const quilt = mergeContributions(sources);
  renderStats(quilt);
  if (graphEl) graphEl.innerHTML = renderGraph(quilt);
  result?.classList.remove("hidden");
  result?.classList.add("flex");

  if (errors.length) {
    setStatus(`Skipped ${errors.map((e) => e.username).join(", ")} — ${errors[0].message}.`, true);
  } else {
    setStatus("");
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const usernames = parseUsernames(input?.value ?? "");
  updateUrl(usernames);
  void run(usernames);
});

// Hydrate from a shared ?u=a,b link.
const fromUrl = parseUsernames(new URLSearchParams(location.search).get("u") ?? "");
if (fromUrl.length && input) {
  input.value = fromUrl.join(", ");
  void run(fromUrl);
}
