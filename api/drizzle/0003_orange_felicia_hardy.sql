ALTER TABLE "apps" ADD COLUMN "project_id" uuid;--> statement-breakpoint
WITH "legacy_project" AS (
	INSERT INTO "projects" ("name")
	SELECT 'Migrated Apps'
	WHERE EXISTS (SELECT 1 FROM "apps")
	RETURNING "id"
)
UPDATE "apps"
SET "project_id" = (SELECT "id" FROM "legacy_project")
WHERE "project_id" IS NULL;--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;
