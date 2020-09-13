# https://developer.algorand.org/tutorials/create-private-network/

export ALGORAND_DATA=`pwd`/node_data/PrimaryNode

create-devnet:
	goal network create -r ./node_data -n private -t devnet-template.json

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
