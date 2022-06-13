export SIGMA_DAO_UNAME = sigma_dao_user
export SIGMA_DAO_PASSWORD = SigmaDao@1234
# Below are objects needed for sigma dao app. Extend it if more sigma dao objects needed
export SIGMA_DAO_OBJECTS = sigma_daos, asset, account_asset, account_app
export SIGMA_DAO_SETUP_FILE = setup_sigma_dao.sql
export POSTGRES_UNAME = algorand
export POSTGRES_DBNAME = pgdb

# drop and create sigma_dao_user
drop-create-sigma-dao-user: drop-sigma-dao-user create-sigma-dao-user

# create sigma_dao_user
create-sigma-dao-user:
	@echo "Setting up user: User=$(SIGMA_DAO_UNAME)"
	@sudo -u postgres createuser $(SIGMA_DAO_UNAME)
	@sudo -u postgres psql -c "ALTER USER $(SIGMA_DAO_UNAME) WITH ENCRYPTED PASSWORD '$(SIGMA_DAO_PASSWORD)';"
# grant only read only access. DML queries has to be disabled to secure the database.
	@psql -U postgres -d pgdb -c "GRANT SELECT ON TABLE $(SIGMA_DAO_OBJECTS) TO $(SIGMA_DAO_UNAME);"

# drop sigma_dao_user
drop-sigma-dao-user:
	@echo "Deleting User=$(SIGMA_DAO_UNAME)"
	@psql -d $(POSTGRES_DBNAME) -c "REASSIGN OWNED BY $(SIGMA_DAO_UNAME) TO postgres;"
	@psql -d $(POSTGRES_DBNAME) -c "DROP OWNED BY $(SIGMA_DAO_UNAME);"
	@psql -d $(POSTGRES_DBNAME) -c "DROP USER $(SIGMA_DAO_UNAME);"

# execute sigma dao setup file
setup_sigma_dao:
	@psql -U $(POSTGRES_UNAME) -d $(POSTGRES_DBNAME) -a -f $(SIGMA_DAO_SETUP_FILE)
