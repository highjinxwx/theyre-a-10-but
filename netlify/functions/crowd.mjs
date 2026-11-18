// Anonymous daily stats endpoint, backed by Netlify Database (PostgreSQL).
// GET  /api/crowd?day=YYYY-MM-DD&v=3   -> public aggregate distributions
//      add &player=<browser id>         -> also that player's pairwise Crowd Match
//                                          (only their own score; no one's picks are returned)
// POST /api/crowd                     -> save one completed daily ranking
// No Supabase keys or manually managed database URLs are needed.
import { getDatabase } from '@netlify/database';

const GAME_VERSION = 3; // Match `const V = 3` in public/index.html.
const TIME_ZONE = 'America/New_York';
const RANK_COUNT = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function easternDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validRanks(ranks) {
  return Array.isArray(ranks) && ranks.length === RANK_COUNT &&
    ranks.every((rank) => Number.isInteger(rank) && rank >= 1 && rank <= RANK_COUNT) &&
    new Set(ranks).size === RANK_COUNT;
}

/* Pairwise Crowd Match. For every pair of candidates (45 pairs with 10), check whether
   another player put the same one higher than you did. Compared against everyone except
   you; the result is agreed comparisons / total comparisons x 100. */
const PAIRS = [];
for (let i = 0; i < RANK_COUNT; i++) for (let j = i + 1; j < RANK_COUNT; j++) PAIRS.push([i, j]);

export function pairwiseMatch(mine, others) {
  let agreed = 0;
  for (const theirs of others) {
    for (const [i, j] of PAIRS) {
      if (Math.sign(mine[i] - mine[j]) === Math.sign(theirs[i] - theirs[j])) agreed++;
    }
  }
  const comparisons = others.length * PAIRS.length;
  return {
    percent: comparisons ? (100 * agreed) / comparisons : null,
    agreed, comparisons, others: others.length,
  };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async function crowd(request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const day = url.searchParams.get('day') || easternDay();
      const versionInput = url.searchParams.get('v');
      const version = versionInput === null ? GAME_VERSION : Number(versionInput);
      if (!validDay(day) || !Number.isInteger(version) || version < 1 || version > 100) {
        return json({ error: 'Invalid day or version' }, 400);
      }

      const db = getDatabase();
      // Values inside ${...} are parameterized by the Netlify database driver.
      const rows = await db.sql`
        SELECT r.position::integer AS candidate,
               r.chosen_rank::integer AS rank,
               COUNT(*)::bigint AS votes
        FROM public.daily_plays AS p
        CROSS JOIN LATERAL unnest(p.ranks) WITH ORDINALITY AS r(chosen_rank, position)
        WHERE p.play_date = ${day}::date AND p.game_version = ${version}
        GROUP BY r.position, r.chosen_rank
      `;

      // Index 0 is unused; the game reads ranks using indexes 1...10.
      const counts = Array.from({ length: RANK_COUNT }, () => Array(RANK_COUNT + 1).fill(0));
      for (const row of rows) {
        const candidate = Number(row.candidate);
        const rank = Number(row.rank);
        if (candidate >= 1 && candidate <= RANK_COUNT && rank >= 1 && rank <= RANK_COUNT) {
          counts[candidate - 1][rank] = Number(row.votes);
        }
      }
      const players = counts[0].reduce((total, votes) => total + votes, 0);

      // Optional: this browser's own pairwise Crowd Match for the day.
      let match = null;
      const player = url.searchParams.get('player');
      if (player !== null) {
        if (!UUID_RE.test(player)) return json({ error: 'Invalid player' }, 400);
        const plays = await db.sql`
          SELECT (player_id = ${player}::uuid) AS mine, ranks
          FROM public.daily_plays
          WHERE play_date = ${day}::date AND game_version = ${version}
        `;
        const toRanks = (row) => Array.from(row.ranks, Number);
        const me = plays.find((row) => row.mine);
        if (me) match = pairwiseMatch(toRanks(me), plays.filter((row) => !row.mine).map(toRanks));
      }
      return json({ day, v: version, players, counts, match });
    }

    // POST: only a completed, correctly-ranked daily lineup for the current
    // Eastern day is accepted. No game starts or partial selections are logged.
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'Request too large' }, 413);
    let body;
    try { body = JSON.parse(raw); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const day = easternDay();
    if (body === null || typeof body !== 'object' ||
        body.day !== day || body.v !== GAME_VERSION ||
        typeof body.playerId !== 'string' || !UUID_RE.test(body.playerId) ||
        !validRanks(body.ranks)) {
      return json({ error: 'Invalid game submission' }, 400);
    }

    // Build an explicit PostgreSQL array literal only after strict integer/
    // permutation validation, then bind it as a SQL parameter. No string
    // interpolation of browser data occurs in SQL source text.
    const pgRanks = `{${body.ranks.join(',')}}`;
    const db = getDatabase();
    await db.sql`
      INSERT INTO public.daily_plays (play_date, game_version, player_id, ranks)
      VALUES (${day}::date, ${GAME_VERSION}, ${body.playerId}::uuid, ${pgRanks}::smallint[])
      ON CONFLICT (play_date, game_version, player_id) DO NOTHING
    `;
    return json({ ok: true, day, v: GAME_VERSION }, 201);
  } catch (error) {
    // Logs include technical detail; public responses do not expose database internals.
    console.error('Crowd stats error:', error);
    return json({ error: 'Statistics are temporarily unavailable' }, 503);
  }
}

export const config = {
  path: '/api/crowd',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
