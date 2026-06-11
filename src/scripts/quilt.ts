import { track } from "@vercel/analytics";
import { ContributionsError, fetchContributions } from "../lib/contributions";
import { PALETTES, PRESETS, type Theme } from "../lib/levels";
import { mergeContributions } from "../lib/merge";
import { MAX_ACCOUNTS, parseUsernames } from "../lib/parse";
import { isHexColor, placeholderSvg, renderQuiltSvg } from "../lib/svg";
import type { AccountContributions, Quilt } from "../lib/types";

type Year = number | "last";
type EmbedFmt = "md" | "html" | "auto" | "url";

/**
 * The look of the one artifact on the page. The card, the snippet, the
 * shareable URL and the png are all derived from this single value — change
 * it anywhere and every mirror updates.
 *
 * Custom carries only what was explicitly chosen (a touched swatch, a hex
 * URL param) — never invented values. That keeps hydrate → render → emit a
 * fixed point: feeding the page its own URL reproduces the exact same card,
 * and the params always mean what /u/[users].svg says they mean.
 */
type Look =
  | { kind: "default" }
  | { kind: "light" }
  | { kind: "preset"; name: string }
  | { kind: "custom"; theme: Theme; color?: string; bg?: string };

const EMBED_ORIGIN = "https://quilt.jass.gg";
const YEARS_BACK = 10;

const form = document.querySelector<HTMLFormElement>("#quilt-form");
const submit = document.querySelector<HTMLButtonElement>(
  "#quilt-form button[type='submit']",
);
const input = document.querySelector<HTMLInputElement>("#quilt-input");
const exampleRow = document.querySelector<HTMLElement>("#quilt-example-row");
const example = document.querySelector<HTMLAnchorElement>("#quilt-example");
const status = document.querySelector<HTMLParagraphElement>("#quilt-status");
const result = document.querySelector<HTMLElement>("#quilt-result");
const statsEl = document.querySelector<HTMLElement>("#quilt-stats");
const graphEl = document.querySelector<HTMLElement>("#quilt-graph");
const yearSel = document.querySelector<HTMLSelectElement>("#quilt-year");
const themeSel = document.querySelector<HTMLSelectElement>("#quilt-theme");
const customRow = document.querySelector<HTMLElement>("#quilt-custom");
const colorInput = document.querySelector<HTMLInputElement>("#quilt-color");
const bgInput = document.querySelector<HTMLInputElement>("#quilt-bg");
const fmtSel = document.querySelector<HTMLSelectElement>("#quilt-fmt");
const embedCode = document.querySelector<HTMLElement>("#quilt-embed-code");
const embedCopy =
  document.querySelector<HTMLButtonElement>("#quilt-embed-copy");
const shareBtn = document.querySelector<HTMLButtonElement>("#quilt-share");
const downloadBtn =
  document.querySelector<HTMLButtonElement>("#quilt-download");

let activeUsernames: string[] = [];
let activeYear: Year = "last";
let look: Look = { kind: "default" };
let embedFmt: EmbedFmt = "md";
let currentQuilt: Quilt | null = null;
// supersession counter — the last-started run owns the DOM
let runSeq = 0;

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

// ---- the look ----

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Expand to canonical #rrggbb — input[type=color] and luminance() need it. */
function normalizeHex(s: string): string {
  const h = s.replace(/^#/, "").toLowerCase();
  const six =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return `#${six}`;
}

/**
 * The look as renderQuiltSvg options — a straight pass-through, so the page
 * paints exactly what /u/[users].svg would for the same params.
 */
function lookRenderOptions(): {
  theme: Theme;
  color?: string;
  bg?: string;
} {
  if (look.kind === "light") return { theme: "light" };
  if (look.kind === "preset") {
    const p = PRESETS[look.name];
    return { theme: p.theme, color: p.color, bg: p.bg };
  }
  if (look.kind === "custom")
    return { theme: look.theme, color: look.color, bg: look.bg };
  return { theme: "dark" };
}

/** Query params describing the look — mirrors /u/[users].svg semantics. */
function lookParams(): string[] {
  if (look.kind === "light") return ["theme=light"];
  // the named form is what reads well (and spreads) in READMEs
  if (look.kind === "preset") return [`theme=${look.name}`];
  if (look.kind === "custom") {
    const q: string[] = [];
    if (look.theme === "light") q.push("theme=light");
    if (look.color) q.push(`color=${look.color.replace("#", "")}`);
    if (look.bg) q.push(`bg=${look.bg.replace("#", "")}`);
    return q;
  }
  return [];
}

/** The look's name for the theme select and analytics. */
function lookLabel(): string {
  if (look.kind === "preset") return look.name;
  if (look.kind === "custom") return "custom";
  return look.kind;
}

/** Read a look back from URL params (page-side mirror of the svg route). */
function lookFromParams(params: URLSearchParams): Look {
  const themeParam = params.get("theme") ?? "";
  const preset = Object.hasOwn(PRESETS, themeParam)
    ? PRESETS[themeParam]
    : undefined;
  const rawColor = params.get("color");
  const rawBg = params.get("bg");
  const color =
    rawColor && isHexColor(rawColor) ? normalizeHex(rawColor) : undefined;
  const bg = rawBg && isHexColor(rawBg) ? normalizeHex(rawBg) : undefined;
  // explicit hex params win — the select can't show "dracula, but edited".
  // the declared theme is kept and missing parts stay absent, exactly as
  // the server resolves them; nothing is invented here.
  if (color || bg) {
    return {
      kind: "custom",
      theme: preset?.theme ?? (themeParam === "light" ? "light" : "dark"),
      color: color ?? preset?.color,
      bg: bg ?? preset?.bg,
    };
  }
  if (preset) return { kind: "preset", name: themeParam };
  if (themeParam === "light") return { kind: "light" };
  return { kind: "default" };
}

/** Make the controls show the current look (select value, swatch visibility). */
function syncLookControls(): void {
  if (themeSel) themeSel.value = lookLabel();
  const isCustom = look.kind === "custom";
  customRow?.classList.toggle("hidden", !isCustom);
  customRow?.classList.toggle("flex", isCustom);
  if (look.kind === "custom") {
    // swatches need concrete values to display — fall back to the active
    // theme's stock colors without committing them to the look
    if (colorInput)
      colorInput.value = look.color ?? PALETTES[look.theme].levels[4];
    if (bgInput) bgInput.value = look.bg ?? PALETTES[look.theme].bg;
  }
}

// ---- rendering the one artifact ----

function paintCard(): void {
  if (!graphEl || !currentQuilt) return;
  // replacing innerHTML resets the container's scroll — a restyle on a
  // phone must not yank the card back to the oldest weeks
  const scroll = graphEl.scrollLeft;
  const card = renderQuiltSvg(currentQuilt, {
    ...lookRenderOptions(),
    embed: true,
  });
  // a year with zero days renders as nothing — show the same friendly card
  // the embed URL serves instead of a void
  graphEl.innerHTML =
    card ||
    placeholderSvg("no contributions in this range", lookRenderOptions().theme);
  graphEl.scrollLeft = scroll;
}

function renderStats(quilt: Quilt): void {
  if (!statsEl) return;
  const n = (v: number) => v.toLocaleString("en-US");
  const num = (v: number) => `<span class="nums text-text">${n(v)}</span>`;
  // each stat is one unbreakable unit — "15-" / "day current streak" split
  // across lines reads as a garbled number
  const stat = (html: string) =>
    `<span class="whitespace-nowrap">${html}</span>`;
  const parts = [stat(`${num(quilt.total)} contributions`)];
  if (quilt.longestStreak > 0)
    parts.push(stat(`${num(quilt.longestStreak)}-day longest streak`));
  if (quilt.currentStreak > 0)
    parts.push(stat(`${num(quilt.currentStreak)}-day current streak`));
  statsEl.innerHTML = parts.join(" · ");
}

function populateYearSelect(): void {
  if (!yearSel) return;
  const now = new Date().getFullYear();
  const years = Array.from({ length: YEARS_BACK }, (_, i) => now - i);
  yearSel.innerHTML = [
    `<option value="last">last year</option>`,
    ...years.map((y) => `<option value="${y}">${y}</option>`),
  ].join("");
}

/** A shared link can reach further back than the menu — list its year too. */
function ensureYearOption(year: Year): void {
  if (!yearSel || year === "last") return;
  const v = String(year);
  const options = Array.from(yearSel.options);
  if (options.some((o) => o.value === v)) return;
  const before = options.find(
    (o) => o.value !== "last" && Number(o.value) < year,
  );
  yearSel.add(new Option(v, v), before ?? null);
}

function populateThemeSelect(): void {
  if (!themeSel) return;
  themeSel.innerHTML = [
    `<option value="default">default</option>`,
    `<option value="light">light</option>`,
    ...Object.keys(PRESETS).map((k) => `<option value="${k}">${k}</option>`),
    `<option value="custom">custom…</option>`,
  ].join("");
}

// ---- the snippet ----

function embedUrl(): string {
  const q = [...lookParams()];
  if (activeYear !== "last") q.push(`y=${activeYear}`);
  const base = `${EMBED_ORIGIN}/u/${activeUsernames.join(",")}.svg`;
  return q.length ? `${base}?${q.join("&")}` : base;
}

function lightEmbedUrl(): string {
  const q = ["theme=light"];
  if (activeYear !== "last") q.push(`y=${activeYear}`);
  return `${EMBED_ORIGIN}/u/${activeUsernames.join(",")}.svg?${q.join("&")}`;
}

function embedSnippet(): string {
  const url = embedUrl();
  // camo strips links inside the SVG, so this outer link is the only
  // clickable path from a README back to the quilt it shows.
  const page = `${EMBED_ORIGIN}/?u=${activeUsernames.join(",")}${
    activeYear !== "last" ? `&y=${activeYear}` : ""
  }`;
  const alt = `contribution quilt for ${activeUsernames.join(" + ")}`;
  if (embedFmt === "md") return `[![${alt}](${url})](${page})`;
  if (embedFmt === "html")
    return `<a href="${page}"><img src="${url}" alt="${alt}" /></a>`;
  if (embedFmt === "auto") {
    // follows GitHub's color mode: the current look in dark, a clean light
    // card in light — a dark slab on a light README is how embeds get deleted.
    return `<a href="${page}"><picture><source media="(prefers-color-scheme: dark)" srcset="${url}" /><source media="(prefers-color-scheme: light)" srcset="${lightEmbedUrl()}" /><img src="${url}" alt="${alt}" /></picture></a>`;
  }
  return url;
}

function renderSnippet(): void {
  if (embedCode) embedCode.textContent = embedSnippet();
}

// ---- state mirrors: url, card, snippet ----

function updateUrl(): void {
  const url = new URL(location.href);
  const set = (key: string, value: string | null) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  };
  set("u", activeUsernames.length ? activeUsernames.join(",") : null);
  set("y", activeYear !== "last" ? String(activeYear) : null);
  // the look rides along, so a shared link reproduces the styled card
  for (const key of ["theme", "color", "bg"]) url.searchParams.delete(key);
  for (const param of lookParams()) {
    const [key, value] = param.split("=");
    url.searchParams.set(key, value);
  }
  history.replaceState(null, "", url);
}

/** Repaint everything the look touches: card, snippet, URL, controls. */
function applyLook(): void {
  syncLookControls();
  paintCard();
  renderSnippet();
  updateUrl();
}

// ---- core ----

function errorMessage(reason: unknown): string {
  if (reason instanceof ContributionsError) return reason.message;
  return "something went wrong";
}

/** "user: message", unless the message already names the user. */
function describeError(e: { username: string; message: string }): string {
  return e.message.includes(e.username)
    ? e.message
    : `${e.username}: ${e.message}`;
}

async function run(usernames: string[], year: Year): Promise<void> {
  if (!usernames.length) {
    setStatus("add at least one GitHub username.", true);
    return;
  }
  // same cap as the embed route — otherwise the snippet silently disagrees
  // with the quilt the page just showed.
  const overflow = usernames.length - MAX_ACCOUNTS;
  if (overflow > 0) usernames = usernames.slice(0, MAX_ACCOUNTS);
  setStatus(
    `stitching ${usernames.length} account${usernames.length === 1 ? "" : "s"}…`,
  );

  const seq = ++runSeq;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "stitching…";
  }
  // a card is already up (year change, account edit) — dim it instead of
  // blanking the hero while the new one is fetched
  if (currentQuilt && graphEl) {
    graphEl.classList.add("opacity-50");
    graphEl.setAttribute("aria-busy", "true");
  }

  const settled = await Promise.allSettled(
    usernames.map((u) => fetchContributions(u, { year })),
  );

  // a newer run started while we were fetching — its results own the DOM
  if (seq !== runSeq) return;
  if (submit) {
    submit.disabled = false;
    submit.textContent = "stitch →";
  }
  graphEl?.classList.remove("opacity-50");
  graphEl?.removeAttribute("aria-busy");

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
    // nothing was committed — the card, snippet, URL and controls still
    // agree on the quilt that's (maybe) on screen
    if (yearSel && currentQuilt) yearSel.value = String(activeYear);
    setStatus(errors.map(describeError).join(" · "), true);
    return;
  }

  // success — commit the state every mirror derives from
  activeUsernames = usernames;
  activeYear = year;
  ensureYearOption(year);
  if (yearSel) yearSel.value = String(year);
  updateUrl();

  // the funnel: stitch → copy embed / copy link / download png
  track("stitch", { accounts: sources.length });

  currentQuilt = mergeContributions(sources);
  renderStats(currentQuilt);
  paintCard();
  renderSnippet();
  result?.classList.remove("hidden");
  result?.classList.add("flex");
  exampleRow?.classList.add("hidden");
  // on phones the card scrolls — land on the most recent weeks (must run
  // after the un-hide: a hidden element has no scrollWidth)
  if (graphEl) graphEl.scrollLeft = graphEl.scrollWidth;

  const notes: string[] = [];
  if (overflow > 0)
    notes.push(
      `quilts cap at ${MAX_ACCOUNTS} accounts — dropped the last ${overflow}`,
    );
  if (errors.length)
    notes.push(`skipped: ${errors.map(describeError).join(" · ")}`);
  setStatus(notes.join(" · "), notes.length > 0);
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  let usernames = parseUsernames(input?.value ?? "");
  // stitching the empty form runs the example the placeholder is showing
  if (!usernames.length && input) {
    usernames = parseUsernames(input.placeholder);
    input.value = usernames.join(", ");
  }
  void run(usernames, activeYear);
});

example?.addEventListener("click", (event) => {
  event.preventDefault();
  const demo = parseUsernames(
    new URL(example.href).searchParams.get("u") ?? "",
  );
  if (input) input.value = demo.join(", ");
  void run(demo, activeYear);
});

yearSel?.addEventListener("change", () => {
  void run(activeUsernames, parseYear(yearSel.value));
});

themeSel?.addEventListener("change", () => {
  const v = themeSel.value;
  if (v === "custom") {
    // open custom exactly where the current look left off — the card must
    // not change until a swatch is actually moved
    look = { kind: "custom", ...lookRenderOptions() };
  } else if (v === "light") {
    look = { kind: "light" };
  } else if (Object.hasOwn(PRESETS, v)) {
    look = { kind: "preset", name: v };
  } else {
    // selecting "default" IS the reset
    look = { kind: "default" };
  }
  applyLook();
});

const onSwatch = () => {
  if (!colorInput || !bgInput) return;
  // a touched swatch makes both values explicit; the label palette follows
  // the background so light cards get readable labels (same rule the URL
  // then declares as ?theme=light, keeping the server in agreement)
  look = {
    kind: "custom",
    theme: luminance(bgInput.value) > 0.6 ? "light" : "dark",
    color: colorInput.value,
    bg: bgInput.value,
  };
  applyLook();
};
colorInput?.addEventListener("input", onSwatch);
bgInput?.addEventListener("input", onSwatch);

fmtSel?.addEventListener("change", () => {
  embedFmt = (fmtSel.value as EmbedFmt) || "md";
  renderSnippet();
});

// clicking the snippet selects it whole — half-copied embeds are broken embeds
embedCode?.addEventListener("click", () => {
  const selection = window.getSelection();
  if (!selection || selection.toString()) return;
  selection.selectAllChildren(embedCode);
});

function copyWithFeedback(
  button: HTMLButtonElement,
  text: string,
  idleLabel: string,
): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      button.textContent = "copied";
      setTimeout(() => (button.textContent = idleLabel), 1500);
    })
    .catch(() => {
      button.textContent = "press ⌘C";
      setTimeout(() => (button.textContent = idleLabel), 1500);
    });
}

embedCopy?.addEventListener("click", () => {
  if (!embedCopy) return;
  track("copy embed", { format: embedFmt, theme: lookLabel() });
  copyWithFeedback(embedCopy, embedSnippet(), "copy");
});

downloadBtn?.addEventListener("click", () => {
  if (!currentQuilt || !downloadBtn) return;
  track("download png", { theme: lookLabel() });
  // rasterize the card on screen client-side: SVG → <img> → canvas → png.
  // the card is self-contained (system font, no external refs), so the
  // canvas stays untainted.
  const svgStr = renderQuiltSvg(currentQuilt, {
    ...lookRenderOptions(),
    embed: true,
  });
  const svgUrl = URL.createObjectURL(
    new Blob([svgStr], { type: "image/svg+xml" }),
  );
  const img = new Image();
  img.onload = () => {
    const scale = 2; // crisp on retina and social-feed zoom
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `quilt-${activeUsernames.join("-")}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    }
    URL.revokeObjectURL(svgUrl);
  };
  img.onerror = () => {
    URL.revokeObjectURL(svgUrl);
    downloadBtn.textContent = "couldn't render";
    setTimeout(() => (downloadBtn.textContent = "download png"), 1500);
  };
  img.src = svgUrl;
});

shareBtn?.addEventListener("click", () => {
  if (!shareBtn) return;
  track("copy link");
  // the address bar already holds the shareable ?u= state — surface it
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    void navigator.share({ url: location.href }).catch(() => {});
    return;
  }
  copyWithFeedback(shareBtn, location.href, "copy link");
});

populateYearSelect();
populateThemeSelect();

// Hydrate from a shared ?u=a,b&y=2024&theme=dracula link — render the final
// state directly, no transitions.
const params = new URLSearchParams(location.search);
look = lookFromParams(params);
syncLookControls();
const fromUrl = parseUsernames(params.get("u") ?? "");
if (fromUrl.length && input) {
  input.value = fromUrl.join(", ");
  void run(fromUrl, parseYear(params.get("y")));
} else if (input && matchMedia("(pointer: fine)").matches) {
  // desktop only — autofocus on touch would pop the keyboard over the page
  input.focus();
}
