# They're a 10, But... — Netlify Database daily statistics kit

This is a replacement for the **earlier Supabase starter kit**. Use this version **instead**, not both.

Designed for `github.com/highjinxwx/theyre-a-10-but` (the version with **one `index.html` in the repo root** and `const V = 3`, inspected November 17, 2026).

**No Supabase, API keys, database password, sign-in, React, Vite, or frontend build command.** The browser stays static. A Netlify Function securely calls Netlify's managed PostgreSQL database through `@netlify/database`.

## What's in this kit

```text
(theyre-a-10-but repo root)
├── package.json                       # Installs @netlify/database on Netlify
├── netlify.toml                       # Publish only public/, no build command
├── .gitignore
├── public/
│   └── index.html                     # Your existing index.html will move here
├── netlify/
│   ├── database/
│   │   └── migrations/
│   │       └── 20261118010000_create_daily_plays.sql
│   └── functions/
│       └── crowd.mjs                  # /api/crowd GET and POST
├── tools/
│   ├── apply_frontend_patch.py
│   ├── frontend_crowd.js.txt
│   └── frontend_math.js.txt
└── docs/
    ├── FRONTEND_PATCH.md
    └── STATS_QUERIES.sql
```

`public/index.html` is **not** included: we don't want to overwrite your game's source/design. The patcher below moves and edits your existing file automatically. If you prefer editing in GitHub, follow the manual steps in `docs/FRONTEND_PATCH.md`.

## Setup: easiest path (Windows terminal / VS Code)

1. **Back up or commit your current game** in GitHub before starting.
2. Download and extract this kit. Copy its **contents** into the root folder of your local `theyre-a-10-but` checkout, next to the existing `index.html`. Do not commit the ZIP itself or put everything inside an extra `theyre-a-10-but-netlify-db` subfolder.
3. In that repository folder, run:

   ```powershell
   py tools/apply_frontend_patch.py
   ```

   If Python uses `python` on your computer instead of `py`, use `python tools/apply_frontend_patch.py`.

   It checks the original source, replaces only the old Claude data integration and crowd-scoring functions, and **moves** `index.html` into `public/index.html` (the old root file is deleted only after the new file is written). Your layout, traits, gameplay, art, and styling remain in the HTML.
4. Review the modified file, then commit and push the project to the existing GitHub repository:

   ```bash
   git add -A
   git commit -m "Add Netlify Database daily statistics"
   git push
   ```

5. In Netlify, your settings should be:

   | Setting | Value |
   | --- | --- |
   | Base directory | Empty |
   | Build command | **Empty** (delete `npm run build` if still present) |
   | Publish directory | `public` (also specified by `netlify.toml`) |
   | Functions directory | `netlify/functions` (in `netlify.toml`) |
   | Branch | `main` |

6. Deploy. With the `@netlify/database` dependency and migration in the repository, **Netlify should provision the database and apply the SQL migration automatically**. On a credit-based Netlify plan, you can also inspect it in the Netlify project dashboard under **Data & Storage → Database**. The database might need an initial provision step in your UI if automatic setup is unavailable. There are no manual database environment variables to configure.

7. Test the API by visiting this URL (replace the domain):

   ```text
   https://YOUR-SITE.netlify.app/api/crowd
   ```

   Before anyone finishes the daily game, you'll get something like `{"day":"2026-11-17","v":3,"players":0,"counts":[...]}`. After you complete one daily game, refresh the URL and `players` should become `1`. Reload the game; it should **remain 1** for your browser, not double-count. If you completed today's game *before* installing this kit, loading that saved completion should submit it automatically.

## If you edit only on GitHub.com (no local Python)

Copy the provided files through GitHub's upload/editor. Then open your existing `index.html`, rename its path to `public/index.html`, and make the three JavaScript edits in `docs/FRONTEND_PATCH.md`. Commit to `main`. **Do not upload `public/` as an empty directory**; GitHub doesn't track empty folders. Only `public/index.html` matters for the site.

## What is stored

One row per completed **daily** game per browser ID and game version:

| Column | Example | Meaning |
| --- | --- | --- |
| `play_date` | `2026-11-17` | Shared Eastern-time date |
| `game_version` | `3` | Game rules/deck version |
| `player_id` | random UUID | Persistent pseudonymous browser identifier |
| `ranks` | `{8,1,3,10,7,2,4,5,6,9}` | Ranking assigned to each of 10 candidate positions |
| `created_at` | timestamp | Completion record created |

It doesn't record names, email addresses, IP addresses in the table, free-play rounds, page views, starts, partial games, or time spent. Function infrastructure can still process standard request metadata such as IP addresses for rate limiting and logging.

## How to read your numbers

- **Daily counts and candidate averages:** open `docs/STATS_QUERIES.sql`, and run its queries in your Netlify Database SQL interface if available, or via Netlify CLI.
- **Netlify CLI:** from the linked project folder, use `netlify database connect` for an interactive SQL session, or `netlify database connect --query "SELECT COUNT(*) FROM public.daily_plays"`.
- **Crowd API:** `GET /api/crowd?day=2026-11-17&v=3` returns only aggregate counts per candidate and rank. The game reads this after a round and for yesterday's verdict.

## Important notes

- There is **no build script**. `package.json` supplies the Netlify server function's dependency; Netlify installs it during deployment. Do **not** reintroduce `npm run build`.
- Netlify automatically tracks and applies schema migrations from `netlify/database/migrations/` when using Netlify Database. **Do not paste this migration into Supabase.**
- The game version in `netlify/functions/crowd.mjs` (`GAME_VERSION = 3`) must match `const V = 3` in `public/index.html`. Bump both if the deterministic deck/rules change.
- Date changes at **midnight US Eastern**. A game started before midnight may need a refresh to submit after midnight.
- The duplicate safeguard is **one submission per browser UUID/day/version**, not one per human. Clearing storage, changing browsers, or malicious clients can evade it. Function rate limiting helps but does not make public statistics tamper-proof.
- `public/` is the only published directory: the SQL migration and function source are kept outside the static site. Only aggregates are returned through the public route.
- Netlify Database consumes credits on credit-based plans. Check your Netlify usage and the database sleep/compute configuration before promoting heavily.
- **Testing status:** JavaScript syntax and patcher smoke tests were performed offline. No live Netlify account/database was connected; production migration/endpoint behavior still needs a real deployment test.

## Troubleshooting

- **Netlify says `Missing script: build` or `npm run build`:** remove the Build command from the Netlify UI. The included `netlify.toml` contains no build command.
- **Site returns 404:** check that your repository has `public/index.html`, Netlify Publish directory is `public`, and `netlify.toml` is in the repository root.
- **`/api/crowd` returns 404:** check `netlify/functions/crowd.mjs` exists in the correct path; read the deploy log's Functions section.
- **`/api/crowd` returns 503:** inspect Netlify's Function logs; then Database provisioning and migration logs in Netlify. Don't put database connection strings into the HTML to work around it.
- **`/api/crowd` returns 400 when saving:** check that browser and server use the same `V` / `GAME_VERSION`, that the play is completed, and that the page was loaded on the current Eastern date.
- **`players` stays at 0:** check that daily test reshuffle mode is `false`; only a completed daily round submits.

## Official documentation

- https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/
- https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/
- https://docs.netlify.com/build/data-and-storage/netlify-database/api/
- https://docs.netlify.com/build/data-and-storage/netlify-database/cli/
- https://docs.netlify.com/build/functions/get-started/
- https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
