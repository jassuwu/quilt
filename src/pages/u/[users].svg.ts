import type { APIRoute } from "astro";
import { fetchContributions, isValidUsername } from "../../lib/contributions";
import { mergeContributions } from "../../lib/merge";
import { placeholderSvg, renderQuiltSvg } from "../../lib/svg";
import type { AccountContributions } from "../../lib/types";

export const prerender = false;

const MAX_ACCOUNTS = 10;

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
 *   /u/jassuwu,torvalds.svg            -> dark, last 12 months
 *   /u/jassuwu,torvalds.svg?theme=light&y=2024
 *
 * works in github readmes (`![](url)`) and any site (`<img src>`).
 */
export const GET: APIRoute = async ({ params, url }) => {
  const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
  const usernames = (params.users ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_ACCOUNTS)
    .filter(isValidUsername);

  if (!usernames.length) {
    return svg(
      placeholderSvg(
        "add GitHub usernames, e.g. /u/octocat,torvalds.svg",
        theme,
      ),
      400,
      "public, max-age=300",
    );
  }

  const y = url.searchParams.get("y");
  const year = y && /^\d{4}$/.test(y) ? Number(y) : "last";

  const settled = await Promise.allSettled(
    usernames.map((u) => fetchContributions(u, { year })),
  );
  const sources = settled.flatMap((outcome): AccountContributions[] =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
  if (!sources.length) {
    return svg(
      placeholderSvg("couldn't load those accounts", theme),
      502,
      "public, max-age=60",
    );
  }

  const body = renderQuiltSvg(mergeContributions(sources), {
    theme,
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
