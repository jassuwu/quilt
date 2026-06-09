import { ContributionsError, fetchContributions } from "../lib/contributions";
import { mergeContributions } from "../lib/merge";
import { renderQuiltSvg } from "../lib/svg";
import type { AccountContributions, Quilt } from "../lib/types";

type Year = number | "last";
type EmbedFmt = "md" | "html" | "url";

const EMBED_ORIGIN = "https://quilt.jass.gg";

const form = document.querySelector<HTMLFormElement>("#quilt-form");
const input = document.querySelector<HTMLInputElement>("#quilt-input");
const status = document.querySelector<HTMLParagraphElement>("#quilt-status");
const result = document.querySelector<HTMLElement>("#quilt-result");
const statsEl = document.querySelector<HTMLElement>("#quilt-stats");
const graphEl = document.querySelector<HTMLElement>("#quilt-graph");
const yearsEl = document.querySelector<HTMLElement>("#quilt-years");
const embedTabs = document.querySelector<HTMLElement>("#quilt-embed-tabs");
const embedCode = document.querySelector<HTMLElement>("#quilt-embed-code");
const embedCopy =
  document.querySelector<HTMLButtonElement>("#quilt-embed-copy");
const embedLight =
  document.querySelector<HTMLInputElement>("#quilt-embed-light");

let activeUsernames: string[] = [];
let activeYear: Year = "last";
let embedFmt: EmbedFmt = "md";

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

function parseYear(raw: string | null): Year {
  if (!raw || raw === "last") return "last";
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2008 && n <= 2100 ? n : "last";
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
    stat(
      n(quilt.usernames.length),
      quilt.usernames.length === 1 ? "account" : "accounts",
    ),
    stat(`${n(quilt.longestStreak)}`, "longest streak"),
    stat(`${n(quilt.currentStreak)}`, "current streak"),
  ].join("");
}

function renderYears(): void {
  if (!yearsEl) return;
  const now = new Date().getFullYear();
  const years: Year[] = ["last", now, now - 1, now - 2, now - 3, now - 4];
  yearsEl.innerHTML = years
    .map((y) => {
      const isActive = y === activeYear;
      const text = y === "last" ? "last year" : String(y);
      const cls = isActive
        ? "bg-accent text-bg"
        : "bg-surface text-muted hover:text-text";
      return `<button type="button" data-year="${y}" aria-pressed="${isActive}" class="rounded-md px-3 py-1.5 text-sm transition ${cls}">${text}</button>`;
    })
    .join("");
  yearsEl.classList.remove("hidden");
  yearsEl.classList.add("flex");
}

function embedUrl(): string {
  const base = `${EMBED_ORIGIN}/u/${activeUsernames.join(",")}.svg`;
  const q: string[] = [];
  if (embedLight?.checked) q.push("theme=light");
  if (activeYear !== "last") q.push(`y=${activeYear}`);
  return q.length ? `${base}?${q.join("&")}` : base;
}

function embedSnippet(): string {
  const url = embedUrl();
  if (embedFmt === "md") return `![my quilt](${url})`;
  if (embedFmt === "html") return `<img src="${url}" alt="my quilt" />`;
  return url;
}

function renderEmbed(): void {
  if (embedTabs) {
    const tabs: [EmbedFmt, string][] = [
      ["md", "markdown"],
      ["html", "html"],
      ["url", "url"],
    ];
    embedTabs.innerHTML = tabs
      .map(([fmt, label]) => {
        const cls =
          fmt === embedFmt
            ? "bg-surface text-text"
            : "text-muted hover:text-text";
        return `<button type="button" data-fmt="${fmt}" class="rounded-md px-2.5 py-1 transition ${cls}">${label}</button>`;
      })
      .join("");
  }
  if (embedCode) embedCode.textContent = embedSnippet();
}

function errorMessage(reason: unknown): string {
  if (reason instanceof ContributionsError) return reason.message;
  return "something went wrong";
}

function updateUrl(): void {
  const url = new URL(location.href);
  if (activeUsernames.length)
    url.searchParams.set("u", activeUsernames.join(","));
  else url.searchParams.delete("u");
  if (activeYear !== "last") url.searchParams.set("y", String(activeYear));
  else url.searchParams.delete("y");
  history.replaceState(null, "", url);
}

async function run(usernames: string[], year: Year): Promise<void> {
  if (!usernames.length) {
    setStatus("add at least one GitHub username.", true);
    return;
  }
  activeUsernames = usernames;
  activeYear = year;
  updateUrl();
  renderYears();
  setStatus(
    `stitching ${usernames.length} account${usernames.length === 1 ? "" : "s"}…`,
  );

  const settled = await Promise.allSettled(
    usernames.map((u) => fetchContributions(u, { year })),
  );
  const sources: AccountContributions[] = [];
  const errors: { username: string; message: string }[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") sources.push(outcome.value);
    else
      errors.push({
        username: usernames[i],
        message: errorMessage(outcome.reason),
      });
  });

  if (!sources.length) {
    setStatus(
      errors.map((e) => `${e.username}: ${e.message}`).join(" · "),
      true,
    );
    return;
  }

  const quilt = mergeContributions(sources);
  renderStats(quilt);
  if (graphEl) graphEl.innerHTML = renderQuiltSvg(quilt);
  renderEmbed();
  result?.classList.remove("hidden");
  result?.classList.add("flex");

  if (errors.length) {
    setStatus(
      `skipped ${errors.map((e) => e.username).join(", ")} — ${errors[0].message}.`,
      true,
    );
  } else {
    setStatus("");
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void run(parseUsernames(input?.value ?? ""), activeYear);
});

yearsEl?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-year]");
  if (!button) return;
  void run(activeUsernames, parseYear(button.getAttribute("data-year")));
});

embedTabs?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-fmt]");
  if (!button) return;
  embedFmt = (button.getAttribute("data-fmt") as EmbedFmt | null) ?? "md";
  renderEmbed();
});

embedLight?.addEventListener("change", renderEmbed);

embedCopy?.addEventListener("click", () => {
  const button = embedCopy;
  if (!button) return;
  navigator.clipboard
    .writeText(embedSnippet())
    .then(() => {
      button.textContent = "copied";
      setTimeout(() => (button.textContent = "copy"), 1500);
    })
    .catch(() => {
      button.textContent = "press ⌘C";
      setTimeout(() => (button.textContent = "copy"), 1500);
    });
});

// Hydrate from a shared ?u=a,b&y=2024 link.
const params = new URLSearchParams(location.search);
const fromUrl = parseUsernames(params.get("u") ?? "");
if (fromUrl.length && input) {
  input.value = fromUrl.join(", ");
  void run(fromUrl, parseYear(params.get("y")));
}
