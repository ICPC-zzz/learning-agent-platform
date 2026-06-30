-- A518: Align DailyContentItem.kind with current Prisma schema String field.
-- Non-destructive: preserves existing values by casting enum/text values to TEXT.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'DailyContentItem'
      AND column_name = 'kind'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE "DailyContentItem"
      ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
  END IF;
END $$;
