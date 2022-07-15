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
    cd project-dev
    yarn algob init . $2
    touch yarn.lock
    yarn link -r ../../web
    yarn link -r ../../runtime
    yarn link -r ../
  ;;

  exec)
    cd project-dev
    echo DIRECTORY: `pwd`
    echo ">> list workspace node modules/bin"
    ls -la ../../../node_modules/.bin

    # ../../../node_modules/.bin/algob ${*:2}
    ./build/internal/cli/cli.js ${*:2}
    ;;

  *)
    echo -n "unknown command. Expecte create or exec"
    ;;
esac
