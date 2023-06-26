UPDATE public.version
    SET schema_version = COALESCE(${schema_version}, schema_version),
        schema_version_update_date = COALESCE(${schema_version_update_date}, schema_version_update_date),
        active_version = COALESCE(${active_version}, active_version),
        active_version_update_date = COALESCE(${active_version_update_date}, active_version_update_date)
    RETURNING *;
