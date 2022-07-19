#!/bin/bash

## Usage
## start dev project:
##    ./project-dev-script.sh create [--npm] [--typescript]
## run algob command:
##    ./project-dev-script.sh exec node-info

case $1 in
  create)
    if [ -d "project-dev" ]; then
      echo "% project-dev already exists. skipping the setup"
      exit 0;
    fi;
    yarn build
    mkdir project-dev
    cd project-dev
    if [ "$2" != "--npm" ]; then
      echo "adding yarn"
      touch yarn.lock
      yarn install
      rm package.json
    fi;
    # yarn algob init ${*:2} .
    node ../build/internal/cli/cli.js init ${*:2} .

    # wip: see how we can use yarn link
    if [ "$2" != "--npm" ]; then
      yarn link -r ../../web
      yarn link -r ../../runtime
      yarn link -r ../
    fi;
  ;;

  exec)
    cd project-dev
    echo ">> list workspace node modules/bin"
    ls -la ../../../node_modules/.bin

    echo ">> list algob"
    ls -la ../

    # node ../../../node_modules/.bin/algob ${*:2}
    node ../build/internal/cli/cli.js ${*:2}
    ;;

  *)
    echo -n "unknown command. Expecte create or exec"
    ;;
esac
