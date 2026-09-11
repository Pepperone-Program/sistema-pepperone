-- Keep InnoDB on application rollback: older code is compatible, and reverting
-- to MyISAM would remove transaction guarantees. No data/schema rollback needed.
SELECT 1;
