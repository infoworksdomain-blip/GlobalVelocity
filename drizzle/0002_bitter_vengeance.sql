CREATE TABLE "ugc_clip_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid,
	"requested_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "overlay_style" jsonb;--> statement-breakpoint
ALTER TABLE "ugc_clips" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "ugc_clips" ADD COLUMN "ingest_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "ugc_clip_batches" ADD CONSTRAINT "ugc_clip_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_clips" ADD CONSTRAINT "ugc_clips_ingest_batch_id_ugc_clip_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ugc_clip_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ugc_status_tier" ON "ugc_clips" USING btree ("status","tier");--> statement-breakpoint
CREATE INDEX "ugc_category" ON "ugc_clips" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ugc_created_at" ON "ugc_clips" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ugc_style_gin" ON "ugc_clips" USING gin ("style_tags");