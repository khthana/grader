-- Per-test-case score (#66): an io Problem's max score is the sum of its
-- Test Case scores. Before #66 the editor saved problems.score independently,
-- so existing rows can disagree with what grading uses. Reconcile them.
-- Data-only (no schema change); idempotent. Unit-mode problems keep their score.
UPDATE problems
   SET score = (SELECT SUM(tc.score)::int FROM test_cases tc WHERE tc.problem_id = problems.id)
 WHERE problem_type <> 'unit'
   AND EXISTS (SELECT 1 FROM test_cases tc WHERE tc.problem_id = problems.id);
