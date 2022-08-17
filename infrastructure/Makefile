# https://developer.algorand.org/tutorials/create-private-network/

# check platform
PLATFORM := $(shell uname -s)
export ALGORAND_DATA=`pwd`/node_data/PrimaryNode
export SANDBOX_PATH = ~/.algorand-sandbox
export REMOTE_REPO = https://github.com/algorand/sandbox.git
export REACH_PATH = ~/.algorand-reach
# paths for indexer (for docker setup)
export INDEXER_REMOTE_REPO = https://github.com/algorand/indexer.git
export INDEXER_PATH = ~/.algorand-indexer-download
# path to indexer .tar file (https://github.com/algorand/indexer/releases) for local setup
export INDEXER_LATEST_VERSION = 2.13.0
export INDEXER_TAR_NAME = algorand-indexer_$(OS)_amd64_$(INDEXER_LATEST_VERSION).tar.bz2
export INDEXER_TAR_URL = https://github.com/algorand/indexer/releases/download/$(INDEXER_LATEST_VERSION)/$(INDEXER_TAR_NAME)
# default postgres config vars
export POSTGRES_UNAME = algorand
export POSTGRES_DBNAME = pgdb
export POSTGRES_PASS = indexer

ifeq ($(PLATFORM),Darwin)
	export OS = "darwin"
else
	export OS = "linux"
endif

setup-private-net: create-private-net start-private-net setup-master-account status-private-net
recreate-private-net: stop-private-net delete-private-net setup-private-net

create-private-net:
	@if [ -d ./node_data ] ;  then echo "./node_data directory already exists - remove it if you want to create a new private network" ; false; fi
	@goal network create -r ./node_data -n private -t private-net-template.json
	@echo '{ "GossipFanout": 0, "EndpointAddress": "127.0.0.1:4001", "DNSBootstrapID": "", "EnableProfiler": true, "NetAddress": "127.0.0.1:0", "EnableDeveloperAPI": true }' > ./node_data/PrimaryNode/config.json
	@echo 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' > ./node_data/PrimaryNode/algod.token
	@echo '127.0.0.1:4001' > ./node_data/PrimaryNode/algod-listen.net
	echo 'PrimaryNode config and access token set.'

status-private-net:
	goal network status -r ./node_data

start-private-net:
	goal network start -r ./node_data

restart-private-net:
	goal network restart -r ./node_data

stop-private-net:
	goal network stop -r ./node_data

delete-private-net:
	goal network delete -r ./node_data

start-kmd:
	goal kmd start -d $(ALGORAND_DATA)

stop-kmd:
	goal kmd stop -d $(ALGORAND_DATA)


account-list:
	goal -d $(ALGORAND_DATA) account list

setup-master-account:
# Create an account with WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE address:
	goal account import -m "enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital" -d $(ALGORAND_DATA) || true
	@goal account rename Unnamed-0 master -d $(ALGORAND_DATA) || true
# Send lot of ALGO from a primary account to the "master" account we created above
	@$(eval list=$(shell goal account list -d $(ALGORAND_DATA)))
	@$(eval netAddress=$(shell echo $(list) | awk '{print $$2}'))
	@goal clerk send -a 2000000000000 -f $(netAddress) -t WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE -d $(ALGORAND_DATA)

sandbox-up-dev:
# start algod dev version
# clone sandbox git repo: https://github.com/algorand/sandbox.git and pull
	[ -d $(SANDBOX_PATH) ] || git clone $(REMOTE_REPO) $(SANDBOX_PATH)
	(cd $(SANDBOX_PATH); git reset --hard; git pull;)
# override .yml with custom config (custom token and port for private network)
	cat ./sandbox-docker-compose.yml > $(SANDBOX_PATH)/docker-compose.yml
	$(SANDBOX_PATH)/sandbox up dev -v

sandbox-up:
# start algod stable version
# clone sandbox git repo: https://github.com/algorand/sandbox.git and pull
	[ -d $(SANDBOX_PATH) ] || git clone $(REMOTE_REPO) $(SANDBOX_PATH)
	(cd $(SANDBOX_PATH); git reset --hard; git pull;)
# override .yml with custom config (custom token and port for private network)
	cat ./sandbox-docker-compose.yml > $(SANDBOX_PATH)/docker-compose.yml
	$(SANDBOX_PATH)/sandbox up -v

sandbox-down:
# stops docker containers for algod, indexer and indexer-db
	$(SANDBOX_PATH)/sandbox down

sandbox-clean:
# clean up env (removing stopped docker containers, images)
	$(SANDBOX_PATH)/sandbox clean

sandbox-reset:
# reset the containers to their initial state.
	$(SANDBOX_PATH)/sandbox reset

sandbox-algod-shell:
# Opens algod container bash shell
	$(SANDBOX_PATH)/sandbox enter algod

sandbox-setup-master-account:
# similar to setup-master-account but with sandbox, goal commands are executed using the ./sandbox file
	$(SANDBOX_PATH)/sandbox goal account import -m "enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital" || true
	@$(eval list=$(shell $(SANDBOX_PATH)/sandbox goal account list))
	@$(eval netAddress=$(shell echo $(list) | awk '{print $$2}'))
	$(SANDBOX_PATH)/sandbox goal clerk send -a 2000000000000 -f $(netAddress) -t WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE

# Extracting mnemonic:
# goal -d $(ALGORAND_DATA) account export -a <account address>

# https://docs.reach.sh/tut-1.html
setup-reach:
	mkdir -p $(REACH_PATH)
	curl https://raw.githubusercontent.com/reach-sh/reach-lang/master/reach -o $(REACH_PATH)/reach
	chmod +x $(REACH_PATH)/reach
# download/update docker images from https://hub.docker.com/u/reachsh
	$(REACH_PATH)/reach update
# echo reach version
	$(REACH_PATH)/reach version

remove-reach:
	if ! [ -f $(REACH_PATH)/reach ]; then	\
		echo "Error reach not found: $(REACH_PATH)/reach does not exist."; exit 1; fi
# halt any dockerized devnets, docker kill and rm all images
	$(REACH_PATH)/reach down
	$(REACH_PATH)/reach docker-reset
	rm -r $(REACH_PATH)

## --- Indexer jobs (local based)--- ##

setup-postgresql:
# Source: https://www.postgresql.org/download/linux/ubuntu/
	sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
	wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
	sudo apt-get update; sudo apt-get -y install postgresql;
# log connection info
	sudo -u postgres psql -c "\conninfo"
# Create user (with password) and database. Grant permissions.
	@echo "Setting up database: User=$(POSTGRES_UNAME) password=$(POSTGRES_PASS) dbname=$(POSTGRES_DBNAME)"
	@sudo -u postgres createuser $(POSTGRES_UNAME)
	@sudo -u postgres createdb $(POSTGRES_DBNAME)
	@sudo -u postgres psql -c "alter user $(POSTGRES_UNAME) with encrypted password '$(POSTGRES_PASS)';"
	@sudo -u postgres psql -c "grant all privileges on database $(POSTGRES_DBNAME) to $(POSTGRES_UNAME)"
# List databases
	@sudo -u postgres psql -c "\l"

recreate-indexer-db:
	@sudo -u postgres psql -c "DROP DATABASE IF EXISTS $(POSTGRES_DBNAME);"
	@sudo -u postgres createdb $(POSTGRES_DBNAME)
	@sudo -u postgres psql -c "grant all privileges on database $(POSTGRES_DBNAME) to $(POSTGRES_UNAME)"

# Sets up indexer in local mode (to be used with private-net)
start-indexer:
	@if ! [ -d ./node_data ] ;  then echo "./node_data directory does not exist - please create a new private network first" ; false; fi
# https://developer.algorand.org/docs/run-a-node/setup/indexer/#extract-the-binaries-to-a-specific-directory
	mkdir -p $(INDEXER_PATH)
# download and unzip .tar file
	@if ! [ -f $(INDEXER_PATH)/$(INDEXER_TAR_NAME) ]; then \
		wget $(INDEXER_TAR_URL) -P $(INDEXER_PATH); \
		cd $(INDEXER_PATH); tar -xf $(INDEXER_TAR_NAME) -C $(INDEXER_PATH); fi
# Start indexer by providing database connection info and path to algod node
	$(INDEXER_PATH)/algorand-indexer_$(OS)_amd64_$(INDEXER_LATEST_VERSION)/algorand-indexer daemon --data-dir /tmp -P "host=localhost port=5432 user=$(POSTGRES_UNAME) password=$(POSTGRES_PASS) dbname=$(POSTGRES_DBNAME) sslmode=disable" --algod=./node_data/PrimaryNode --dev-mode

recreate-indexer: recreate-indexer-db start-indexer

remove-indexer:
# remove local indexer directory
	rm -rf $(INDEXER_PATH)
