-- #Note: Indexer should be running before executing the queries present in this file
-- Indexer schema:
--  https://github.com/algorand/indexer/blob/develop/idb/postgres/internal/schema/setup_postgres.sql

-- create a sigma_daos table if does not exit already.
CREATE TABLE IF NOT EXISTS sigma_daos (
  id SERIAL PRIMARY KEY, -- auto increment id
  app_id bigint, -- application id
  app_params jsonb, -- application params with approval etc.
  asset_id bigint -- token id
);

-- create a procedure to handle the trigger (sigmadao_trigger_fn) action
CREATE OR REPLACE FUNCTION sigmadao_trigger_fn()
RETURNS TRIGGER
AS $$
DECLARE
    asset_id bigint;
	log_sigma text := 'U2lnbWFEQU8gY3JlYXRlZA==';
	i record;
BEGIN
	/* 	Check to avoid duplicate entries in table. id attribute increments despite pass/fail insertion  */
	IF EXISTS (SELECT FROM sigma_daos p WHERE p.app_id = NEW.asset) THEN
		RETURN NEW;
	END IF;
	/* 	txn colmun of txn relation stores both asset and app id. typeenum column
		identifies the asset and app */
	FOR i IN SELECT txn FROM txn WHERE asset = NEW.asset AND typeenum=6 LOOP
		/*	sigma dao contrac check. Here 'dt' and 'lg' is a json object present
			in each record of txn column */
		IF i.txn::jsonb -> 'dt'->'lg' ?& ARRAY[log_sigma] THEN
			-- TODO: Fetch asset id from global state not from latest entry in asset table
			-- store token id from db to above decalred variable asset_id
			SELECT index INTO asset_id FROM public.asset ORDER BY index DESC LIMIT 1;
			-- insert values in sigma_daos table
			INSERT INTO public.sigma_daos (
			app_id, app_params, asset_id)
			VALUES (NEW.asset, NEW.txn, asset_id);
			EXIT;
		END IF;
    END LOOP;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- create a trigger (sigmadao_trigger)
-- Event: INSERT on publoc.txn relation
CREATE TRIGGER sigmadao_trigger
AFTER INSERT ON public.txn FOR EACH ROW
EXECUTE FUNCTION sigmadao_trigger_fn();

-- grant privileges to relation sigma_daos
GRANT ALL PRIVILEGES ON TABLE sigma_daos TO algorand;
