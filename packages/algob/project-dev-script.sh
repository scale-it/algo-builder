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
      exit 0;
    fi;
    yarn build
    mkdir -p project-dev/node_modules/.bin
    cd project-dev
    yarn algob init . $2
    touch yarn.lock
    yarn link -r ../../web
    yarn link -r ../../runtime
    yarn link -r ../
    cd node_modules/.bin/
    ln -s ../../../node_modules/.bin/algob ./
  ;;

  exec)
    cd project-dev
    yarn algob $2 $3 $4
    ;;

  *)
    echo -n "unknown command. Expecte create or exec"
    ;;
esac
