-- They're a 10, But... — read-only reporting queries for Netlify Database.
-- Run in a SQL client / Netlify Database CLI; NOT in the game's browser console.

-- A. Completed daily games, newest first
SELECT play_date, game_version, COUNT(*) AS completed_plays
FROM public.daily_plays
GROUP BY play_date, game_version
ORDER BY play_date DESC, game_version DESC;

-- B. Candidate average rank and number of votes per date (candidate 1...10)
SELECT p.play_date, p.game_version,
       r.position::integer AS candidate,
       COUNT(*) AS votes,
       ROUND(AVG(r.chosen_rank)::numeric, 2) AS average_rank
FROM public.daily_plays AS p
CROSS JOIN LATERAL unnest(p.ranks) WITH ORDINALITY AS r(chosen_rank, position)
GROUP BY p.play_date, p.game_version, r.position
ORDER BY p.play_date DESC, p.game_version DESC, candidate;

-- C. All 10 possible rankings for each candidate on a particular day
SELECT r.position::integer AS candidate,
       r.chosen_rank::integer AS rank,
       COUNT(*) AS votes
FROM public.daily_plays AS p
CROSS JOIN LATERAL unnest(p.ranks) WITH ORDINALITY AS r(chosen_rank, position)
WHERE p.play_date = DATE '2026-11-17' AND p.game_version = 3
GROUP BY r.position, r.chosen_rank
ORDER BY candidate, rank;

-- D. Total lifetime completions (rows, not necessarily distinct humans)
SELECT COUNT(*) AS all_time_completed_games
FROM public.daily_plays;
