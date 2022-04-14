#!/bin/bash

case $1 in
  create)
    if [ -d "project-dev" ]; then
      echo "% project-dev already exists. skipping the setup"
    else
      mkdir -p project-dev/node_modules
      cd project-dev
      node ../build/internal/cli/cli.js init . $2
      cd node_modules
      ln -s ../../build/ algob
      cd ..
    fi
    ;;

  exec)
    cd project-dev
    node ../build/internal/cli/cli.js $2 $3
    ;;

  *)
    echo -n "unknown"
    ;;
esac