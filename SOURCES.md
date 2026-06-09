# Sources

_Last verified: 2026-06-09._

quilt has exactly one data source.

| Source                                                                                        | Endpoint                                                            | Auth | Returns                                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| [grubersjoe/github-contributions-api](https://github.com/grubersjoe/github-contributions-api) | `https://github-contributions-api.jogruber.de/v4/{username}?y=last` | none | `{ total, contributions: [{ date, count, level }] }` for the trailing 12 months |

It **scrapes the public profile graph**, so it includes privatized-but-visible
contributions whenever an account has _Settings → Profile → Include private
contributions on my profile_ enabled — i.e. exactly what the profile already shows.

## Why not the GitHub GraphQL API

`contributionsCollection` [cannot include private contributions even when
authenticated](https://github.com/orgs/community/discussions/24812). It would
undercount any account that displays privatized green, defeating the purpose.
The scrape-based API matches the rendered profile.

## Known limits

- Accounts must be public on GitHub.
- Scrape-based, so it can break if GitHub changes the profile markup.
- Rate limit: 12 requests/min for `cache-control: no-cache` requests. quilt relies on
  the API's ~1h server cache plus a per-session client cache, so normal use stays well under it.
- Private-repo contributions only appear if the owner enabled the profile toggle above.

## Reproduce it yourself

```sh
curl 'https://github-contributions-api.jogruber.de/v4/jassuwu?y=last'
```
