-- #Note: Indexer should be running before executing the queries present in this file
-- Indexer schema:
-- https://github.com/algorand/indexer/blob/develop/idb/postgres/internal/schema/setup_postgres.sql

-- create a sigma_dao_proposal table if does not exit already.
CREATE TABLE IF NOT EXISTS sigma_dao_proposals (
  id SERIAL PRIMARY KEY, -- auto increment id
  addr BYTEA,  -- account address
  app_id BIGINT, -- SigmaDAO app id
  localstate JSONB, -- localstate of addr
  voting_start BIGINT, -- voting start
  voting_end BIGINT -- voting end
);

-- create an index to do efficient text search using `%<text>%`, it requires
CREATE INDEX sigma_daos_dao_name_idx ON app USING gin (CAST(dao_name AS TEXT) gin_trgm_ops);

-- create a procedure to handle the trigger (sigmadao_proposals_trigger_fn) action
CREATE OR REPLACE FUNCTION sigmadao_proposals_trigger_fn()
RETURNS TRIGGER
AS $$
DECLARE
	voting_start_key CHAR(255) := 'dm90aW5nX3N0YXJ0'; -- Byte code of 'voting_end'
	voting_end_key CHAR(255) := 'dm90aW5nX2VuZA=='; -- Byte code of 'voting_end'
	voting_start_value BIGINT;
	voting_end_value BIGINT;
BEGIN
	-- Iterate json object to tkv object and fetch the voting start key
	IF (SELECT NEW.localstate::jsonb -> 'tkv' -> voting_start_key) IS NOT NULL THEN
		-- Iterate json object and get voting start value
		SELECT NEW.localstate::jsonb -> 'tkv' -> voting_start_key -> 'ui' INTO voting_start_value;
		-- Iterate json object and get voting end value
		SELECT NEW.localstate::jsonb -> 'tkv' -> voting_end_key -> 'ui' INTO voting_end_value;
		-- insert values in sigma_dao_proposals table
		INSERT INTO public.sigma_dao_proposals (
		addr, app_id, localstate, voting_start, voting_end)
		VALUES (NEW.addr, NEW.app, NEW.localstate::jsonb, voting_start_value, voting_end_value);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- create a trigger (sigmadao_proposals_trigger)
-- Event: UPDATE on public.account_app relation
CREATE TRIGGER sigmadao_proposals_trigger
AFTER UPDATE ON public.account_app FOR EACH ROW
EXECUTE FUNCTION sigmadao_proposals_trigger_fn();

-- grant privileges
GRANT ALL PRIVILEGES ON TABLE sigma_dao_proposals TO algorand;

-- Below are objects needed for sigma dao app. Extend it if more sigma dao objects needed
-- Here, sigma_dao_user should be same as https://github.com/scale-it/algo-builder/blob/cbc2123622a10fbf96f9b99b254abc86a79ac1fb/examples/dao/Makefile#L1
GRANT SELECT ON TABLE sigma_dao_proposals, app, asset, account_asset, account_app, account TO sigma_dao_user;

-- Function to search dao name in sigma_daos relation
CREATE OR REPLACE FUNCTION search_sigma_daos(daoToBeSearched TEXT)
RETURNS SETOF app AS $$
	SELECT * FROM app WHERE dao_name ilike ('%' || daoToBeSearched || '%');
$$ LANGUAGE SQL STABLE;

-- Function to search proposal in sigma_dao_proposals relation by app id and filter type
CREATE OR REPLACE FUNCTION sigma_daos_proposal_filter(appId BIGINT, filterType INT)
RETURNS SETOF sigma_dao_proposals AS $$
DECLARE
	voting_end CHAR(255) := 'dm90aW5nX2VuZA=='; -- Byte code of 'voting_end'
	timestamp BIGINT := extract(EPOCH FROM NOW()); -- epoch in seconds
	filter_all INT := 1; -- filter type -> all
	filter_ongoing INT := 2; -- ongoing
	filter_active INT := 3;  -- ongoing + future
	filter_past INT := 4; -- filter type -> past
BEGIN
	IF (filterType = filter_ongoing) THEN
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app_id = appId AND timestamp BETWEEN sigma_dao_proposals.voting_start AND sigma_dao_proposals.voting_end ORDER BY voting_start;
	ELSIF (filterType = filter_active) THEN
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app_id = appId AND timestamp < sigma_dao_proposals.voting_end ORDER BY voting_start;
	ELSIF (filterType = filter_past) THEN
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app_id = appId AND sigma_dao_proposals.voting_end < timestamp ORDER BY voting_end DESC;
	ELSE
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app_id = appId;
	END IF;
END;
$$ LANGUAGE plpgsql STABLE;
