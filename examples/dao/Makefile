export SIGMA_DAO_UNAME = sigma_dao_user
export SIGMA_DAO_PASSWORD = SigmaDao@1234
export SIGMA_DAO_SETUP_FILE = setup_sigma_dao.sql
# https://github.com/scale-it/algo-builder/blob/326d6d34a7279dc0efc32cbcab0fc9ad4161c293/infrastructure/Makefile#L17
export POSTGRES_UNAME = algorand
export POSTGRES_DBNAME = pgdb

# drop and create sigma_dao_user
drop-create-sigma-dao-user: drop-sigma-dao-user create-sigma-dao-user

# create sigma_dao_user
create-sigma-dao-user:
	@echo "Setting up User=$(SIGMA_DAO_UNAME)"
	@psql -U postgres -c "CREATE USER $(SIGMA_DAO_UNAME); ALTER USER $(SIGMA_DAO_UNAME) WITH ENCRYPTED PASSWORD '$(SIGMA_DAO_PASSWORD)'"

# drop sigma_dao_user
drop-sigma-dao-user:
	@echo "Deleting User=$(SIGMA_DAO_UNAME)"
	@psql -d $(POSTGRES_DBNAME) -c "REASSIGN OWNED BY $(SIGMA_DAO_UNAME) TO postgres;"
	@psql -d $(POSTGRES_DBNAME) -c "DROP OWNED BY $(SIGMA_DAO_UNAME);"
	@psql -d $(POSTGRES_DBNAME) -c "DROP USER $(SIGMA_DAO_UNAME);"

# execute sigma dao setup file. Indexer should be running before executing this script
setup-sigma-dao:
# pg_trgm extension.
	@psql -d $(POSTGRES_DBNAME) -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
# execute file
	@psql -U $(POSTGRES_UNAME) -d $(POSTGRES_DBNAME) -a -f $(SIGMA_DAO_SETUP_FILE)
