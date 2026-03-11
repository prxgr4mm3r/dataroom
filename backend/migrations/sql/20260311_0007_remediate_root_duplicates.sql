-- Auto-remediation for duplicate active item names in root scope.
-- Safe to run multiple times.
--
-- Problem:
-- Existing data may contain duplicates with the same
-- (user_id, normalized_name) where parent_id IS NULL and status != 'deleted'.
--
-- Strategy:
-- Keep the first row (oldest created_at, then smallest id) unchanged.
-- Rename each duplicate row with a deterministic unique suffix based on item id.

BEGIN;

WITH ranked AS (
    SELECT
        i.id,
        i.user_id,
        i.name,
        i.normalized_name,
        ROW_NUMBER() OVER (
            PARTITION BY i.user_id, i.normalized_name
            ORDER BY i.created_at ASC, i.id ASC
        ) AS rn
    FROM dataroom_items i
    WHERE i.parent_id IS NULL
      AND i.status != 'deleted'
),
to_fix AS (
    SELECT
        r.id,
        r.name || ' (dedup-' || substr(r.id, 1, 8) || ')' AS new_name
    FROM ranked r
    WHERE r.rn > 1
)
UPDATE dataroom_items
SET
    name = (
        SELECT f.new_name
        FROM to_fix f
        WHERE f.id = dataroom_items.id
    ),
    normalized_name = lower(trim((
        SELECT f.new_name
        FROM to_fix f
        WHERE f.id = dataroom_items.id
    ))),
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM to_fix);

-- Expect 0 after remediation.
SELECT COUNT(*) AS remaining_duplicate_groups
FROM (
    SELECT i.user_id, i.normalized_name
    FROM dataroom_items i
    WHERE i.parent_id IS NULL
      AND i.status != 'deleted'
    GROUP BY i.user_id, i.normalized_name
    HAVING COUNT(*) > 1
) t;

COMMIT;
