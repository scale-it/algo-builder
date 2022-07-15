#!/bin/bash

## Usage
## start dev project:
##    ./project-dev-script.sh create
## run algob command:
##    ./project-dev-script.sh exec node-info

case $1 in
  create)
    if [ -d "project-dev" ]; then
      echo "% project-dev already exists. skipping the setup"
    else
      mkdir -p project-dev/node_modules
      cd project-dev
      yarn algob init . $2
      cd node_modules
      ln -s ../../build/ algob
      cd ..
    fi
    ;;

  exec)
    cd project-dev
    yarn algob $2 $3 $4
    ;;

  *)
    echo -n "unknown"
    ;;
esac
