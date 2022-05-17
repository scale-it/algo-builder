-- #Note: Indexer should be running before executing the queries present in this file
-- Indexer schema:
--  https://github.com/algorand-devrel/demo-avm1.1/tree/master/demos/trampoline

-- create a sigma_daos table if does not exit already.
CREATE TABLE IF NOT EXISTS sigma_daos (
  app_id bigint PRIMARY KEY, -- application id
  app_params jsonb, -- application params with approval etc.
  token_id bigint -- token id
);

-- create a procedure to handle the trigger (update_app) action
CREATE OR REPLACE FUNCTION sigmadao_trigger_fn()
RETURNS TRIGGER
AS $$
DECLARE
    token_id bigint;
	log_sigma text := 'U2lnbWFEQU8gY3JlYXRlZA==';
	i record;
BEGIN
	/* 	txn colmun of txn relation stores both asset and app id. typeenum column
		identifies the asset and app */
	FOR i IN SELECT txn FROM txn WHERE asset = NEW.asset AND typeenum=6 LOOP
		/*	sigma dao contrac check. Here 'dt' and 'lg' is a json object present
			in each record of txn column */
		IF i.txn::jsonb -> 'dt'->'lg' ?& ARRAY[log_sigma] THEN
			-- store token id from db to above decalred variable token_id
			SELECT index INTO token_id FROM public.asset ORDER BY index DESC LIMIT 1;
			-- insert values in sigma_daos table
			INSERT INTO public.sigma_daos (
			app_id, app_params, token_id)
			VALUES (NEW.asset, NEW.txn, token_id);
			EXIT;
		END IF;
    END LOOP;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- create a trigger (update_app)
-- Event: INSERT on publoc.txn relation
CREATE TRIGGER sigmadao_trigger
AFTER INSERT ON public.txn FOR EACH ROW
EXECUTE FUNCTION sigmadao_trigger_fn();

-- grant privileges to relation sigma_daos
GRANT ALL PRIVILEGES ON TABLE sigma_daos TO algorand;
