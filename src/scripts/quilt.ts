import { ContributionsError, fetchContributions } from "../lib/contributions";
import { mergeContributions } from "../lib/merge";
import { renderQuiltSvg } from "../lib/svg";
import type { AccountContributions, Quilt } from "../lib/types";

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
  setStatus(
    `Stitching ${usernames.length} account${usernames.length === 1 ? "" : "s"}…`,
  );

  const settled = await Promise.allSettled(
    usernames.map((u) => fetchContributions(u)),
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
  result?.classList.remove("hidden");
  result?.classList.add("flex");

  if (errors.length) {
    setStatus(
      `Skipped ${errors.map((e) => e.username).join(", ")} — ${errors[0].message}.`,
      true,
    );
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
const fromUrl = parseUsernames(
  new URLSearchParams(location.search).get("u") ?? "",
);
if (fromUrl.length && input) {
  input.value = fromUrl.join(", ");
  void run(fromUrl);
}
