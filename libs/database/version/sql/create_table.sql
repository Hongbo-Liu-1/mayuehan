BEGIN;

    CREATE TABLE IF NOT EXISTS public.version
        (
            schema_version                  text,
            schema_version_update_date      timestamp with time zone,
            active_version                  text,
            active_version_update_date      timestamp with time zone
        );

    -- Initialize the first and only row with NULLs for the table if not already done
    INSERT INTO public.version
        SELECT
        WHERE NOT EXISTS (SELECT * FROM public.version);

COMMIT;
