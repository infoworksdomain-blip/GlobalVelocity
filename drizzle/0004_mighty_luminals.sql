CREATE TABLE "ugc_image_batches" (
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
CREATE TABLE "ugc_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_name" text,
	"gender" text,
	"style_tags" text[] DEFAULT '{}' NOT NULL,
	"category" text,
	"setting" text,
	"width" integer,
	"height" integer,
	"territories" text[] DEFAULT '{"worldwide"}' NOT NULL,
	"licence_expires_at" timestamp with time zone,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"tier" text DEFAULT 'growth' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"ingest_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "ugc_image_id" uuid;--> statement-breakpoint
ALTER TABLE "ugc_image_batches" ADD CONSTRAINT "ugc_image_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_images" ADD CONSTRAINT "ugc_images_ingest_batch_id_ugc_image_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ugc_image_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ugc_image_status_tier" ON "ugc_images" USING btree ("status","tier");--> statement-breakpoint
CREATE INDEX "ugc_image_category" ON "ugc_images" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ugc_image_created_at" ON "ugc_images" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ugc_image_style_gin" ON "ugc_images" USING gin ("style_tags");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_ugc_image_id_ugc_images_id_fk" FOREIGN KEY ("ugc_image_id") REFERENCES "public"."ugc_images"("id") ON DELETE no action ON UPDATE no action;