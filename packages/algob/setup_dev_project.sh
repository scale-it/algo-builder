if [ -d "project-dev" ]; then
  echo "% project-dev already exists. skipping the setup"
  cd project-dev
else
  mkdir -p project-dev/node_modules
  cd project-dev
  node ../build/internal/cli/cli.js init .
  cd node_modules
  ln -s ../../build/ algob
  cd ..
fi

node ../build/internal/cli/cli.js "$@"
