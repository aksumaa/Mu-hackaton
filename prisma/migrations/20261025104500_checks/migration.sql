ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_points_range" CHECK (points >= 0 AND points <= 100);
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_course_range" CHECK (course >= 1 AND course <= 6);
ALTER TABLE "User" ADD CONSTRAINT "User_course_range" CHECK ("course" IS NULL OR ("course" >= 1 AND "course" <= 6));
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_max_range" CHECK ("maxPoints" > 0 AND "maxPoints" <= 100);
CREATE UNIQUE INDEX "SubmissionFile_one_current" ON "SubmissionFile" ("submissionId", "kind") WHERE "isCurrent" = true AND "pending" = false;
CREATE UNIQUE INDEX "SubmissionLink_one_current" ON "SubmissionLink" ("submissionId", "kind") WHERE "isCurrent" = true AND "pending" = false;
