# https://developer.algorand.org/tutorials/create-private-network/

export ALGORAND_DATA=`pwd`/node_data/PrimaryNode

create-private-net:
	@goal network create -r ./node_data -n private -t private-net-template.json
	@echo '{ "GossipFanout": 0, "EndpointAddress": "127.0.0.1:0", "DNSBootstrapID": "", "EnableProfiler": true, "NetAddress": "127.0.0.1:0", "EnableDeveloperAPI": true }' > ./node_data/PrimaryNode/config.json
	@echo 'aade468d25a7aa48fec8082d6a847c48492066a2741f3731e613fdde086cd6e9' > ./node_data/PrimaryNode/algod.token
	echo 'PrimaryNode config and access token set.'

status-private-net:
	goal network status -r ./node_data

start-private-net:
	goal network start -r ./node_data

stop-private-net:
	goal network stop -r ./node_data


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
	goal clerk send -a 2000000000000 -f $(netAddress) -t WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE -d $(ALGORAND_DATA)

# Extracting mnemonic:
# goal -d $(ALGORAND_DATA) account export -a <account address>
