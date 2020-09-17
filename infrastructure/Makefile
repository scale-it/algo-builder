# https://developer.algorand.org/tutorials/create-private-network/

export ALGORAND_DATA=`pwd`/node_data/PrimaryNode

create-devnet:
	goal network create -r ./node_data -n private -t devnet-template.json
	echo '{ "GossipFanout": 0, "EndpointAddress": "127.0.0.1:0", "DNSBootstrapID": "", "EnableProfiler": true, "NetAddress": "127.0.0.1:0", "EnableDeveloperAPI": true }' > ./node_data/PrimaryNode/config.json


status-devnet:
	goal network status -r ./node_data

start-devnet:
	goal network start -r ./node_data

stop-devnet:
	goal network stop -r ./node_data


start-kmd:
	goal kmd start -d $(ALGORAND_DATA)

stop-kmd:
	goal kmd stop -d $(ALGORAND_DATA)


account-list:
	goal -d $(ALGORAND_DATA) account list

# Extracting mnemonic:
# goal -d $(ALGORAND_DATA) account export -a <account address>
