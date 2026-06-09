import type { APIRoute } from "astro";

export const prerender = false;

/**
 * /u/jassuwu,torvalds — the URL people guess, or get by stripping `.svg`
 * from an embed — lands on the quilt instead of a platform 404. The `.svg`
 * route still wins for /u/….svg (mixed segments outrank pure params).
 */
export const GET: APIRoute = ({ params, redirect, url }) => {
  const users = (params.users ?? "").trim();
  if (!users) return redirect("/", 302);
  const q = new URLSearchParams({ u: users });
  const y = url.searchParams.get("y");
  if (y) q.set("y", y);
  return redirect(`/?${q.toString()}`, 302);
};
