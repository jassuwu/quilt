<div align="center">
# quilt
<a href="https://quilt.jass.gg">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="./docs/assets/readme/quilt-poster.png" />
    <img src="./docs/assets/readme/quilt-header.gif?v=6" width="900" alt="quilt: scattered GitHub accounts merging into one contribution quilt" />
  </picture>
</a>

_every account, one quilt._

**try it → [quilt.jass.gg](https://quilt.jass.gg)** · no login, nothing stored

</div>

## embed it anywhere

one line in a README, live from the CDN, re-stitched as the accounts contribute:

```md
[![my contributions](https://quilt.jass.gg/u/jassuwu,torvalds.svg)](https://quilt.jass.gg/?u=jassuwu,torvalds)
```

[![contribution quilt for jassuwu + torvalds](https://quilt.jass.gg/u/jassuwu,torvalds.svg)](https://quilt.jass.gg/?u=jassuwu,torvalds)

style it with `?theme=dracula` (or nord, tokyonight, gruvbox, catppuccin, solarized,
mono, stitch), `?theme=light`, a custom `?color`/`?bg` ramp, `?y=2024` for a year.
or restyle it live on [the site](https://quilt.jass.gg) and copy the snippet.

## how it works

type your GitHub usernames and quilt fetches each account's contribution calendar,
sums every day's count across accounts, recomputes the green levels from the merged
distribution, and paints one quilt. it all runs in your browser, and the result lives
in the URL ([quilt.jass.gg/?u=jassuwu,torvalds](https://quilt.jass.gg/?u=jassuwu,torvalds)),
so it's a shareable link.

the data comes from the [github-contributions-api](https://github.com/grubersjoe/github-contributions-api),
which reads the public profile graph, including the **privatized-but-visible** green
your profile already shows (when the account has that setting on).
[SOURCES.md](SOURCES.md) explains why the official API can't do this.

---

<div align="center">

[MIT](LICENSE) · data via [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) · not affiliated with GitHub

</div>
