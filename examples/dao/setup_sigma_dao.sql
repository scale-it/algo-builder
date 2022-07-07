-- #Note: Indexer should be running before executing the queries present in this file
-- Indexer schema:
-- https://github.com/algorand/indexer/blob/develop/idb/postgres/internal/schema/setup_postgres.sql

-- create a sigma_daos table if does not exit already.
CREATE TABLE IF NOT EXISTS sigma_daos (
  id SERIAL PRIMARY KEY, -- auto increment id
  app_id BIGINT, -- application id
  dao_name CHAR(255), -- dao name
  app_params JSONB, -- application params with approval etc.
  asset_id BIGINT -- token id
);

-- create a sigma_dao_proposal table if does not exit already.
CREATE TABLE IF NOT EXISTS sigma_dao_proposals (
  id SERIAL PRIMARY KEY, -- auto increment id
  addr BYTEA,  -- account address
  app BIGINT, -- app id
  localstate JSONB, -- localstate of addr
  voting_start BIGINT, -- voting start
  voting_end BIGINT -- voting end
);

-- Create indexes
CREATE UNIQUE INDEX sigma_daos_app_id_idx ON sigma_daos (app_id);
-- create an index to do efficient text search using `%<text>%`, it requires
-- pg_trgm extension.
CREATE EXTENSION pg_trgm;
CREATE INDEX sigma_daos_dao_name_idx ON sigma_daos USING gin (dao_name gin_trgm_ops);

-- create a procedure to handle the trigger (sigmadao_trigger_fn) action
CREATE OR REPLACE FUNCTION sigmadao_trigger_fn()
RETURNS TRIGGER
AS $$
DECLARE
	asset_id BIGINT;
	gov_asset TEXT := 'Z292X3Rva2VuX2lk'; -- Byte code of 'gov_token_id'
	-- original app hash
	sigma_dao_app_bytecode TEXT := 'BiAFAQAEAgMmGQp2b3RpbmdfZW5kA3llcwdkZXBvc2l0DmV4ZWN1dGVfYmVmb3JlAm5vBHR5cGULbWluX3N1cHBvcnQCaWQMZ292X3Rva2VuX2lkCGV4ZWN1dGVkBGZyb20JcmVjaXBpZW50BmFtb3VudAJwXwdhYnN0YWluA3VybAloYXNoX2FsZ28Mdm90aW5nX3N0YXJ0BmFzYV9pZAxkZXBvc2l0X2xvY2sEbmFtZQh1cmxfaGFzaANtc2cMbWluX2R1cmF0aW9uDG1heF9kdXJhdGlvbjEYIxJABjwxGSQSMRmBBRIRQAYtMRklEjEZIhIRQAYaNhoAgA9vcHRpbl9nb3ZfdG9rZW4SQAXZNhoAgAxhZGRfcHJvcG9zYWwSQASMNhoAgBJkZXBvc2l0X3ZvdGVfdG9rZW4SQARFNhoAgA1yZWdpc3Rlcl92b3RlEkADezYaAIAHZXhlY3V0ZRJAAmw2GgCAFXdpdGhkcmF3X3ZvdGVfZGVwb3NpdBJAAgk2GgCAEWNsZWFyX3ZvdGVfcmVjb3JkEkABJjYaAIAOY2xvc2VfcHJvcG9zYWwSQAABADIHIytiDUAA/zIHIyhiDkAA7zIHIyhiDSMpYicGZA8QIyliIycEYg0QIhJAAM0yByMrYg4yByMoYg0QMgcjKGINIyliJwZkDxAjKWIjJwRiDRAjEhBAAAEAJTUAIyMnB2M1CzUKMgQiEjQLIhIQMSAyAxIxCTIDEhAxFTIDEhAQIycJYiISIytiMgcMESISNAAiEyMoYjIHDBAiEhEQRLEkshAnCGSyETEAshQqZLISI7IBsyMnFGgjJw9oIycVaCMnEGgjJxFoIyhoIytoIycFaCMnCmgjJwtoIycSaCMnDGgjJxZoIycHaCMnCWgjKWgjJwRoIycOaCJDIjUAQv9bIQQ1AEL/VCQ1AEL/TiMjJw02HAFQYzUJNQgyByIrYg1AAK0yByIoYg5AAJ0yByIoYg0iKWInBmQPECIpYiInBGINECISQAB7MgciK2IOMgciKGINEDIHIihiDSIpYicGZA8QIiliIicEYg0QIxIQQAABACU1ADIHIihiDjIHIitiDjQAIhIQIicJYiMSEBFAACslNQEyBCISRDQJIhJAAAojJw02HAFQaCJDNAgiJwdiEjQBIhIQIhJB/+UAIjUBQv/SIjUAQv+tIQQ1AEL/piQ1AEL/oDIEIhIxIDIDEjEJMgMSEDEVMgMSEBAyBzEAJxNiDRBEsSSyECcIZLIRMQCyFDYaAReyEiOyAbMxACojKmI2GgEXCWYiQzIHIitiDUAA8DIHIihiDkAA4DIHIihiDSIpYicGZA8QIiliIicEYg0QIhJAAL4yByIrYg4yByIoYg0QMgciKGINIiliJwZkDxAiKWIiJwRiDRAjEhBAAAEAJTUANAAiEiInCWIjEhBEIicFYiISQABSIicFYiUSQAAXIicFYiEEEkAAAQAyBCISRCInCSJmIkMyBCUSMwEQJBIQMwETIicKYhIQMwEUIicLYhIQMwESIicMYhIQMwERIicSYhIQREL/xzIEJRIzARAiEhAzAQAiJwpiEhAzAQciJwtiEhAzAQgiJwxiEhBEQv+eIjUAQv9qIQQ1AEL/YyQ1AEL/XSMjJw02HAFQYzUJNQgyBCISIicRYjIHDhAyByIoYg4QIypiIw0QRDQJIxJAAHc0CCInB2ITQABeADcAGgEpEkAARzcAGgEnBBJAAC43ABoBJw4SQAABACInDiInDmIjKmIIZiMnE2IiKGIOQAACIkMjJxMiKGJmQv/0IicEIicEYiMqYghmQv/aIikiKWIjKmIIZkL/zSMnDTYcAVAiJwdiZkL/lCMnDTYcAVAiJwdiZkL/hTIEIg8iOBAkEhAiOBEnCGQSECI4FDIKEhAiOBIjDxBEIyojKmIzARIIZiJDIycFYiMSRDIEIg8iOBAkEhAiOBEnCGQSECI4FDIKEhAiOBIjDxBEMwEgMgMSMwESKmQSEEQjJxQ2GgFmIycPNhoCZiMnFTYaA2Y2GgSAABJAANYjJxA2GgRmNhoFFzUCNhoGFzUDNhoHFzUENhoIFzUFNAIyBw1EIycRNAJmNAM0Ag0nF2Q0AzQCCQ4QJxhkNAM0AgkPEEQjKDQDZjQENAMNRCMrNARmNAUiEjQFJRIRNAUhBBIRRCMnBTQFZiMnBWIiEkAASSMnBWIlEkAAHyMnBWIhBBJAAAEAIycWNhoJZiMnBzEXZiMnCSNmIkMjJwo2GglmIycSNhoKF2YjJws2GgtmIycMNhoMF2ZC/9IjJwo2GglmIycLNhoKZiMnDDYaCxdmQv+5IycQgAZzaGEyNTZmQv8iMgQiEjEgMgMSEDYwACcIZBIQRLEkshAnCGSyETIKshQjshIjsgGzIkMyBCISRCJDI0M2GgIXIw02GgIXNhoDFwwQNhoGF3EANQc1BjQHEEQqNhoAF2cnBjYaARdnJxc2GgIXZycYNhoDF2cnDzYaBGeACGRhb19uYW1lNhoFZycINhoGF2ciQw==';
	app_bytecode TEXT; -- app hash
	dao_name_key_bytecode CHAR(255) := 'ZGFvX25hbWU='; -- Byte code of 'dao_name' key
	dao_name CHAR(255); -- dao_name
	i RECORD;
BEGIN
	-- extract app hash from txn attribute
	SELECT json_extract_path_text(NEW.txn::json, 'txn', 'apap') INTO app_bytecode;
	-- Discard if app hash is not equal
	IF NOT (sigma_dao_app_bytecode = app_bytecode) THEN
		RETURN NEW;
	END IF;
	/* 	txn colmun of txn relation stores both asset and app id. typeenum column
		identifies the asset and app */
	FOR i IN SELECT txn FROM txn WHERE asset = NEW.asset AND typeenum=6 LOOP
		-- check json path exists or not
		IF (SELECT i.txn::jsonb -> 'dt'->'gd'->gov_asset->'ui') IS NOT NULL THEN
			-- Iterate json object and get gov asset from it
			SELECT i.txn::jsonb -> 'dt'->'gd'->gov_asset->'ui' INTO asset_id;
			-- Extract dao name in byte code format from json
			SELECT json_extract_path_text(i.txn::json, 'dt', 'gd', dao_name_key_bytecode, 'bs') INTO dao_name;
			-- Convert extracted byte code format into UTF8
			SELECT convert_from(decode(dao_name, 'base64'), 'UTF8') INTO dao_name;
			-- insert values in sigma_daos table
			INSERT INTO public.sigma_daos (
			app_id, dao_name, app_params, asset_id)
			VALUES (NEW.asset, dao_name, i.txn::jsonb, asset_id);
			EXIT;
		END IF;
    END LOOP;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
		addr, app, localstate, voting_start, voting_end)
		VALUES (NEW.addr, NEW.app, NEW.localstate::jsonb, voting_start_value, voting_end_value);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- create a trigger (sigmadao_trigger)
-- Event: INSERT on publoc.txn relation
CREATE TRIGGER sigmadao_trigger
AFTER INSERT ON public.txn FOR EACH ROW
EXECUTE FUNCTION sigmadao_trigger_fn();

-- create a trigger (sigmadao_proposals_trigger)
-- Event: UPDATE on publoc.account_app relation
CREATE TRIGGER sigmadao_proposals_trigger
AFTER UPDATE ON public.account_app FOR EACH ROW
EXECUTE FUNCTION sigmadao_proposals_trigger_fn();

-- grant privileges
GRANT ALL PRIVILEGES ON TABLE sigma_daos, sigma_dao_proposals TO algorand;

-- Below are objects needed for sigma dao app. Extend it if more sigma dao objects needed
-- Here, sigma_dao_user should be same as https://github.com/scale-it/algo-builder/blob/cbc2123622a10fbf96f9b99b254abc86a79ac1fb/examples/dao/Makefile#L1
GRANT SELECT ON TABLE sigma_daos, sigma_dao_proposals, asset, account_asset, account_app TO sigma_dao_user;

-- Function to search dao name in sigma_daos relation
CREATE OR REPLACE FUNCTION search_sigma_daos(daoToBeSearched TEXT)
RETURNS SETOF sigma_daos AS $$
	SELECT * FROM sigma_daos WHERE dao_name ilike ('%' || daoToBeSearched || '%');
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
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app = appId AND timestamp BETWEEN sigma_dao_proposals.voting_start AND sigma_dao_proposals.voting_end ORDER BY voting_start;
	ELSIF (filterType = filter_active) THEN
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app = appId AND timestamp < sigma_dao_proposals.voting_end ORDER BY voting_start;
	ELSIF (filterType = filter_past) THEN
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app = appId AND sigma_dao_proposals.voting_end < timestamp ORDER BY voting_end DESC;
	ELSE
		RETURN QUERY SELECT * FROM sigma_dao_proposals WHERE app = appId;
	END IF;
END;
$$ LANGUAGE plpgsql STABLE;
