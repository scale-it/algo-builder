# https://developer.algorand.org/tutorials/create-private-network/

export ALGORAND_DATA=`pwd`/node_data/PrimaryNode
export SANDBOX_PATH = ~/.algorand-sandbox
export REMOTE_REPO = https://github.com/algorand/sandbox.git

setup-private-net: create-private-net start-private-net setup-master-account status-private-net
recreate-private-net: stop-private-net delete-private-net setup-private-net

create-private-net:
	@if [ -d ./node_data ] ;  then echo "./node_data directory already exists - remove it if you want to create a new private network" ; false; fi
	@goal network create -r ./node_data -n private -t private-net-template.json
	@echo '{ "GossipFanout": 0, "EndpointAddress": "127.0.0.1:4001", "DNSBootstrapID": "", "EnableProfiler": true, "NetAddress": "127.0.0.1:0", "EnableDeveloperAPI": true }' > ./node_data/PrimaryNode/config.json
	@echo 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' > ./node_data/PrimaryNode/algod.token
	echo 'PrimaryNode config and access token set.'

status-private-net:
	goal network status -r ./node_data

start-private-net:
	goal network start -r ./node_data

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
	goal account import -m "enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital" -d $(ALGORAND_DATA)
# Send lot of ALGO from a primary account to the "master" account we created above
	@$(eval list=$(shell goal account list -d $(ALGORAND_DATA)))
	@$(eval netAddress=$(shell echo $(list) | awk '{print $$2}'))
	@goal clerk send -a 2000000000000 -f $(netAddress) -t WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE -d $(ALGORAND_DATA)

sandbox-up:
# clone sandbox git repo: https://github.com/algorand/sandbox.git and pull
	[ -d $(SANDBOX_PATH) ] || git clone $(REMOTE_REPO) $(SANDBOX_PATH)
	(cd $(SANDBOX_PATH); git pull $(REMOTE_REPO))
# override .yml with custom config (custom token and port for private network)
	cat ./sandbox-docker-compose.yml > $(SANDBOX_PATH)/docker-compose.yml
	$(SANDBOX_PATH)/sandbox up -v

sandbox-down:
# stops docker containers for algod, indexer and indexer-db
	$(SANDBOX_PATH)/sandbox down

sandbox-clean:
# clean up env (removing stopped docker containers, images)
	$(SANDBOX_PATH)/sandbox clean

sandbox-algod-shell:
# Opens algod container bash shell
	$(SANDBOX_PATH)/sandbox enter algod

sandbox-setup-master-account:
# similar to setup-master-account but with sandbox, goal commands are executed using the ./sandbox file
	$(SANDBOX_PATH)/sandbox goal account import -m "enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital"
	@$(eval list=$(shell $(SANDBOX_PATH)/sandbox goal account list))
	@$(eval netAddress=$(shell echo $(list) | awk '{print $$2}'))
	$(SANDBOX_PATH)/sandbox goal clerk send -a 2000000000000 -f $(netAddress) -t WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE

# Extracting mnemonic:
# goal -d $(ALGORAND_DATA) account export -a <account address>
