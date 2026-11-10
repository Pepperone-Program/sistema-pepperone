-- Intentionally retain the company column and index: removing either would
-- discard ownership information or break tenant-scoped landing-page queries.
SELECT 1;
