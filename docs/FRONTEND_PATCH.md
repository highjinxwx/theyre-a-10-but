# Updating the current `index.html` — manual alternative

The recommended method is to run `py tools/apply_frontend_patch.py` against the repository's original `index.html`. If you'd rather edit in GitHub's browser editor, follow these steps **in order**.

## A. Move the HTML file into the `public/` folder

Rename the repository's current `index.html` to `public/index.html`. The included `netlify.toml` publishes **only** `public/`, keeping your SQL migration, backend Function, and dependency files off your public static site.

## B. Replace the original Claude-backed crowd data block

Inside the main `<script>` block, find the comment that begins:

```js
/* ---------- shared results (db) ----------
```

Select from that comment through the **entire** `async function submit(){...}` declaration, stopping immediately before:

```js
/* ---------- test mode: a made-up crowd ----------
```

Replace the selected portion with the complete contents of `tools/frontend_crowd.js.txt`.

**Keep** the `/* ---------- test mode... */` comment and `fakeCrowd()` function that follow it. They still work for your game's sample/test mode.

## C. Replace the original crowd-math functions

Find:

```js
function statsFor(ci, myRank, plays){
```

Select from that function through the complete `score()` function, stopping **before**:

```js
function verdictText(y){
```

Replace with the complete contents of `tools/frontend_math.js.txt`.

## D. Update the daily results player count

Inside `resultsHTML()`, replace exactly this line:

```js
const plays=crowd.plays||[], players=plays.length;
```

with:

```js
const plays=crowd.plays||[], players=Array.isArray(plays)?plays.length:(plays.players||0);
```

## E. Leave the rest alone

- Keep `const V = 3;` and `const TEST_RESHUFFLE = false;` for the real daily game.
- Keep the existing local save logic, trait lists, visual design, and seeded daily shuffle.
- Keep the existing startup code: `else { S = loadState("daily"); render(); connect(); }`.
- No Supabase code, database keys, or npm imports go into the HTML.

After deployment, a **completed daily game** is sent to `/api/crowd` and the game loads crowd aggregates from the same endpoint. Free play remains local. Yesterday's verdict works when that browser has a saved result for yesterday.
