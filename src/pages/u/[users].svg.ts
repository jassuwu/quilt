import type { APIRoute } from "astro";
import {
  ContributionsError,
  fetchContributions,
  isValidUsername,
} from "../../lib/contributions";
import { mergeContributions } from "../../lib/merge";
import { MAX_ACCOUNTS } from "../../lib/parse";
import { isHexColor, placeholderSvg, renderQuiltSvg } from "../../lib/svg";
import type { AccountContributions } from "../../lib/types";

export const prerender = false;

function svg(body: string, status: number, cacheControl: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}

/**
 * embeddable merged contribution quilt as a self-contained svg.
 *
 *   /u/jassuwu,torvalds.svg                          -> dark, last 12 months
 *   /u/jassuwu,torvalds.svg?theme=light&y=2024
 *   /u/jassuwu,torvalds.svg?color=ff6ac1&bg=160e23  -> custom ramp + background
 *
 * works in github readmes (`![](url)`) and any site (`<img src>`).
 */
export const GET: APIRoute = async ({ params, url }) => {
  const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
  const bgParam = url.searchParams.get("bg");
  const colorParam = url.searchParams.get("color");
  const bg = bgParam && isHexColor(bgParam) ? bgParam : undefined;
  const color = colorParam && isHexColor(colorParam) ? colorParam : undefined;
  const usernames = (params.users ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_ACCOUNTS)
    .filter(isValidUsername);

  // Error cards are served with 200: GitHub's camo proxy renders non-2xx
  // responses as a broken-image glyph, so the friendly card would never show
  // in the one place embeds live. Short max-age keeps CDNs from holding them.
  if (!usernames.length) {
    return svg(
      placeholderSvg(
        "add GitHub usernames, e.g. /u/octocat,torvalds.svg",
        theme,
      ),
      200,
      "public, max-age=300",
    );
  }

  const y = url.searchParams.get("y");
  const year = y && /^\d{4}$/.test(y) ? Number(y) : "last";

  // camo gives an origin only a few seconds before it shows a broken image,
  // so one retry and a hard deadline beat the default patient backoff here.
  const settled = await Promise.allSettled(
    usernames.map((u) =>
      fetchContributions(u, {
        year,
        retries: 1,
        signal: AbortSignal.timeout(3500),
      }),
    ),
  );
  const sources = settled.flatMap((outcome): AccountContributions[] =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
  if (!sources.length) {
    const failure = settled.find(
      (outcome) => outcome.status === "rejected",
    ) as PromiseRejectedResult | undefined;
    const reason = failure?.reason;
    const message =
      reason instanceof ContributionsError
        ? reason.message
        : "couldn't load those accounts";
    return svg(placeholderSvg(message, theme), 200, "public, max-age=60");
  }

  const body = renderQuiltSvg(mergeContributions(sources), {
    theme,
    bg,
    color,
    embed: true,
  });
  if (!body) {
    // valid accounts, but nothing in the window — render a friendly card, not a broken image.
    return svg(
      placeholderSvg("no contributions in this range", theme),
      200,
      "public, max-age=300",
    );
  }

  // CDN-cached: fresh ~1h, served stale up to a day while revalidating.
  return svg(
    body,
    200,
    "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
  );
};
