import type { APIRoute } from "astro";
import { fetchContributions, isValidUsername } from "../../lib/contributions";
import { mergeContributions } from "../../lib/merge";
import { renderQuiltSvg } from "../../lib/svg";
import type { AccountContributions } from "../../lib/types";

export const prerender = false;

const MAX_ACCOUNTS = 10;

/**
 * Embeddable merged contribution graph as a self-contained SVG.
 *
 *   /u/jassucyd,jassuwu.svg            → dark, last 12 months
 *   /u/jassucyd,jassuwu.svg?theme=light&y=2024
 *
 * Works in GitHub READMEs (`![](url)`) and any site (`<img src>`).
 */
export const GET: APIRoute = async ({ params, url }) => {
  const requested = (params.users ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_ACCOUNTS);
  const usernames = requested.filter(isValidUsername);

  if (!usernames.length) {
    return new Response(
      "Pass one or more GitHub usernames, e.g. /u/octocat,torvalds.svg",
      { status: 400 },
    );
  }

  const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
  const y = url.searchParams.get("y");
  const year = y && /^\d{4}$/.test(y) ? Number(y) : "last";

  const settled = await Promise.allSettled(
    usernames.map((u) => fetchContributions(u, { year })),
  );
  const sources = settled.flatMap((outcome): AccountContributions[] =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );

  if (!sources.length) {
    return new Response("Could not load contributions for those accounts.", {
      status: 502,
    });
  }

  const svg = renderQuiltSvg(mergeContributions(sources), {
    theme,
    embed: true,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // CDN-cached: fresh ~1h, served stale up to a day while revalidating.
      "Cache-Control":
        "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
};
