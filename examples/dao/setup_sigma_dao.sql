-- #Note: Indexer should be running before executing the queries present in this file
-- Indexer schema:
-- https://github.com/algorand/indexer/blob/develop/idb/postgres/internal/schema/setup_postgres.sql

-- create an index to do efficient text search using `%<text>%`, it requires
CREATE INDEX sigma_daos_dao_name_idx ON app USING gin (CAST(dao_name AS TEXT) gin_trgm_ops);

-- Below are objects needed for sigma dao app. Extend it if more sigma dao objects needed
-- Here, sigma_dao_user should be same as https://github.com/scale-it/algo-builder/blob/cbc2123622a10fbf96f9b99b254abc86a79ac1fb/examples/dao/Makefile#L1
GRANT SELECT ON TABLE app, asset, account_asset, account_app, account TO sigma_dao_user;

-- Function to search dao in app relation by app id and filter type
CREATE OR REPLACE FUNCTION search_sigma_daos(daoToBeSearched TEXT)
RETURNS SETOF app AS $$
	SELECT * FROM app WHERE dao_name ilike ('%' || daoToBeSearched || '%');
$$ LANGUAGE SQL STABLE;

-- Function to search proposal in account_app relation by app id and filter type
CREATE OR REPLACE FUNCTION sigma_daos_proposal_filter(appId BIGINT, filterType INT)
RETURNS SETOF account_app AS $$
DECLARE
	voting_end_byte CHAR(255) := 'dm90aW5nX2VuZA=='; -- Byte code of 'voting_end'
	timestamp BIGINT := extract(EPOCH FROM NOW()); -- epoch in seconds
	filter_all INT := 1; -- filter type -> all
	filter_ongoing INT := 2; -- ongoing
	filter_active INT := 3;  -- ongoing + future
	filter_past INT := 4; -- filter type -> past
BEGIN
	IF (filterType = filter_ongoing) THEN
		RETURN QUERY SELECT * FROM account_app WHERE app = appId AND (SELECT account_app.localstate::jsonb -> 'tkv' -> voting_end_byte) IS NOT NULL AND timestamp BETWEEN account_app.voting_start AND account_app.voting_end ORDER BY account_app.voting_start;
	ELSIF (filterType = filter_active) THEN
		RETURN QUERY SELECT * FROM account_app WHERE app = appId AND (SELECT account_app.localstate::jsonb -> 'tkv' -> voting_end_byte) IS NOT NULL AND timestamp < account_app.voting_end ORDER BY account_app.voting_start;
	ELSIF (filterType = filter_past) THEN
		RETURN QUERY SELECT * FROM account_app WHERE app = appId AND (SELECT account_app.localstate::jsonb -> 'tkv' -> voting_end_byte) IS NOT NULL AND account_app.voting_end < timestamp ORDER BY account_app.voting_end DESC;
	ELSE
		RETURN QUERY SELECT * FROM account_app WHERE app = appId AND (SELECT account_app.localstate::jsonb -> 'tkv' -> voting_end_byte) IS NOT NULL;
	END IF;
END;
$$ LANGUAGE plpgsql STABLE;
