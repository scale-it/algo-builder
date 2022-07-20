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
      # this is to enable creating a project inside this workspace, but not being part of the workspace
      touch yarn.lock
      yarn install
      rm package.json
    fi;
    # yarn algob init ${*:2} .
    echo "n" | node ../build/internal/cli/cli.js init ${*:2} .

    # wip: see how we can use yarn link
    if [ "$2" != "--npm" ]; then
      # yarn add -i ../algo-builder/packages/web
      yarn link -r ../../web
      yarn link -r ../../runtime
      yarn link -r ../
      #yarn add -D chai mocha
    else
      # npm add file:../web
      # npm add file:../runtime
      # npm add file:../algob
      npm link ..
      npm add -D chai mocha
    fi;
  ;;

  exec)
    cd project-dev

    # node ../../../node_modules/.bin/algob ${*:2}
    node ../build/internal/cli/cli.js ${*:2}
    ;;

  *)
    echo -n "unknown command. Expecte create or exec"
    ;;
esac
