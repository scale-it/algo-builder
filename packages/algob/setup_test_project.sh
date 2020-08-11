if [ -d "project-test" ]; then
  echo "% project-test already exists. skipping the setup"
  cd project-test
else
  mkdir -p project-test/node_modules
  cd project-test
  node ../build/internal/cli/cli.js init .
  cd node_modules
  ln -s ../../build/ algob
  cd ..
fi

node ../build/internal/cli/cli.js "$@"
