import { ContributionsError, fetchContributions } from "../lib/contributions";
import { PRESETS } from "../lib/levels";
import { mergeContributions } from "../lib/merge";
import { MAX_ACCOUNTS, parseUsernames } from "../lib/parse";
import { renderQuiltSvg } from "../lib/svg";
import type { AccountContributions, Quilt } from "../lib/types";

type Year = number | "last";
type EmbedFmt = "md" | "html" | "auto" | "url";

const EMBED_ORIGIN = "https://quilt.jass.gg";
const DEFAULT_COLOR = "#39d353";
const DEFAULT_BG = "#0d1117";

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
const yearsEl = document.querySelector<HTMLElement>("#quilt-years");
const embedPreview = document.querySelector<HTMLElement>(
  "#quilt-embed-preview",
);
const embedPresets = document.querySelector<HTMLElement>(
  "#quilt-embed-presets",
);
const embedColor =
  document.querySelector<HTMLInputElement>("#quilt-embed-color");
const embedBg = document.querySelector<HTMLInputElement>("#quilt-embed-bg");
const embedReset =
  document.querySelector<HTMLButtonElement>("#quilt-embed-reset");
const embedTabs = document.querySelector<HTMLElement>("#quilt-embed-tabs");
const embedCode = document.querySelector<HTMLElement>("#quilt-embed-code");
const embedCopy =
  document.querySelector<HTMLButtonElement>("#quilt-embed-copy");
const shareBtn = document.querySelector<HTMLButtonElement>("#quilt-share");
const downloadBtn =
  document.querySelector<HTMLButtonElement>("#quilt-download");

let activeUsernames: string[] = [];
let activeYear: Year = "last";
let embedFmt: EmbedFmt = "md";
// when set, the snippet carries ?theme=<name> instead of hex params —
// the named form is what reads well (and spreads) in READMEs
let activePreset: string | null = null;
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

// ---- embed customizer ----

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function embedOptions(): {
  theme: "light" | "dark";
  color?: string;
  bg?: string;
} {
  const color = embedColor?.value ?? DEFAULT_COLOR;
  const bg = embedBg?.value ?? DEFAULT_BG;
  return {
    theme: luminance(bg) > 0.6 ? "light" : "dark",
    color: color.toLowerCase() === DEFAULT_COLOR ? undefined : color,
    bg: bg.toLowerCase() === DEFAULT_BG ? undefined : bg,
  };
}

function embedUrlWith(opts: {
  theme?: "light" | "dark";
  color?: string;
  bg?: string;
}): string {
  const q: string[] = [];
  if (opts.theme === "light") q.push("theme=light");
  if (activeYear !== "last") q.push(`y=${activeYear}`);
  if (opts.color) q.push(`color=${opts.color.replace("#", "")}`);
  if (opts.bg) q.push(`bg=${opts.bg.replace("#", "")}`);
  const base = `${EMBED_ORIGIN}/u/${activeUsernames.join(",")}.svg`;
  return q.length ? `${base}?${q.join("&")}` : base;
}

function embedUrl(): string {
  if (activePreset) {
    const q = [`theme=${activePreset}`];
    if (activeYear !== "last") q.push(`y=${activeYear}`);
    return `${EMBED_ORIGIN}/u/${activeUsernames.join(",")}.svg?${q.join("&")}`;
  }
  return embedUrlWith(embedOptions());
}

function renderPresets(): void {
  if (!embedPresets) return;
  embedPresets.innerHTML = Object.entries(PRESETS)
    .map(([name, preset]) => {
      const cls =
        name === activePreset
          ? "bg-surface text-text"
          : "text-muted hover:text-text";
      return `<button type="button" data-preset="${name}" class="inline-flex items-center rounded-md px-2.5 py-1 transition ${cls}"><span class="mr-1.5 inline-block size-2 rounded-full" style="background:${preset.color}"></span>${name}</button>`;
    })
    .join("");
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
    // follows GitHub's color mode: customized card in dark, clean light card
    // in light — a dark slab on a light README is how embeds get deleted.
    const light = embedUrlWith({ theme: "light" });
    return `<a href="${page}"><picture><source media="(prefers-color-scheme: dark)" srcset="${url}" /><source media="(prefers-color-scheme: light)" srcset="${light}" /><img src="${url}" alt="${alt}" /></picture></a>`;
  }
  return url;
}

function renderEmbed(): void {
  if (embedTabs) {
    const tabs: [EmbedFmt, string][] = [
      ["md", "markdown"],
      ["html", "html"],
      ["auto", "auto light/dark"],
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

function refreshEmbed(): void {
  if (embedPreview && currentQuilt) {
    embedPreview.innerHTML = renderQuiltSvg(currentQuilt, {
      ...embedOptions(),
      embed: true,
    });
    // the real embed keeps its fixed size for <img> use; the on-page preview
    // scales to the column instead of overflowing into a scrollbar
    const svg = embedPreview.querySelector("svg");
    if (svg) {
      svg.style.maxWidth = "100%";
      svg.style.height = "auto";
    }
  }
  renderPresets();
  renderEmbed();
}

// ---- core ----

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
  // same cap as the embed route — otherwise the snippet silently disagrees
  // with the quilt the page just showed.
  const overflow = usernames.length - MAX_ACCOUNTS;
  if (overflow > 0) usernames = usernames.slice(0, MAX_ACCOUNTS);
  activeUsernames = usernames;
  activeYear = year;
  updateUrl();
  renderYears();
  setStatus(
    `stitching ${usernames.length} account${usernames.length === 1 ? "" : "s"}…`,
  );

  const seq = ++runSeq;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "stitching…";
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

  currentQuilt = mergeContributions(sources);
  renderStats(currentQuilt);
  if (graphEl) {
    graphEl.innerHTML = renderQuiltSvg(currentQuilt);
    // on phones the graph scrolls — land on the most recent weeks
    graphEl.scrollLeft = graphEl.scrollWidth;
  }
  refreshEmbed();
  result?.classList.remove("hidden");
  result?.classList.add("flex");
  exampleRow?.classList.add("hidden");

  const notes: string[] = [];
  if (overflow > 0)
    notes.push(
      `quilts cap at ${MAX_ACCOUNTS} accounts — dropped the last ${overflow}`,
    );
  if (errors.length)
    notes.push(
      `skipped ${errors.map((e) => e.username).join(", ")} — ${errors[0].message}`,
    );
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

embedPresets?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-preset]");
  if (!button) return;
  const name = button.getAttribute("data-preset");
  const preset = name ? PRESETS[name] : undefined;
  if (!name || !preset) return;
  activePreset = name;
  // the pickers mirror the preset so the live preview just works
  if (embedColor) embedColor.value = preset.color;
  if (embedBg) embedBg.value = preset.bg;
  refreshEmbed();
});

const clearPreset = () => {
  activePreset = null;
  refreshEmbed();
};
embedColor?.addEventListener("input", clearPreset);
embedBg?.addEventListener("input", clearPreset);
embedReset?.addEventListener("click", () => {
  activePreset = null;
  if (embedColor) embedColor.value = DEFAULT_COLOR;
  if (embedBg) embedBg.value = DEFAULT_BG;
  refreshEmbed();
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
  if (embedCopy) copyWithFeedback(embedCopy, embedSnippet(), "copy");
});

downloadBtn?.addEventListener("click", () => {
  if (!currentQuilt || !downloadBtn) return;
  // rasterize the embed card client-side: SVG → <img> → canvas → png.
  // the card is self-contained (system font, no external refs), so the
  // canvas stays untainted.
  const svgStr = renderQuiltSvg(currentQuilt, {
    ...embedOptions(),
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
  // the address bar already holds the shareable ?u= state — surface it
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    void navigator.share({ url: location.href }).catch(() => {});
    return;
  }
  copyWithFeedback(shareBtn, location.href, "copy link");
});

// Hydrate from a shared ?u=a,b&y=2024 link.
const params = new URLSearchParams(location.search);
const fromUrl = parseUsernames(params.get("u") ?? "");
if (fromUrl.length && input) {
  input.value = fromUrl.join(", ");
  void run(fromUrl, parseYear(params.get("y")));
} else if (input && matchMedia("(pointer: fine)").matches) {
  // desktop only — autofocus on touch would pop the keyboard over the page
  input.focus();
}
