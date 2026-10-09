-- Least-privilege runtime role for TagYourTurn. Run in the Neon SQL editor as
-- the owner role (neondb_owner). See AGENTS.md, "Database".
--
-- The role already exists in production. For a fresh database, run all of it.
-- After a migration adds a table, run just the matching GRANT line.

-- CREATE ROLE yourturn_app WITH LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
-- GRANT CONNECT ON DATABASE neondb TO yourturn_app;
-- GRANT USAGE ON SCHEMA public TO yourturn_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON "Household", "Night", "Event" TO yourturn_app;

-- Added with migration 0002_rate_limit.
GRANT SELECT, INSERT, UPDATE, DELETE ON "RateLimitHit" TO yourturn_app;
