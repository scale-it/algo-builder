# Builder

This package provides the main entry point into the application.

Please read the main [README](https://github.com/scale-it/algorand-builder/blob/master/README.md) file for details about the project and `algob`. This file provides a development description about the `algob` package.

## Usage


`algob` can be included as a library by importing `internal/lib/lib.ts` or can be run from command line as described in the project [README](https://github.com/scale-it/algorand-builder/blob/master/README.md) file.

### Command line usage

`algob` always starts for checking and loading `algob.config.js` file. The config file will be generated (in the current directory) if not present in the project tree.

Help
`algob help`

View version
`algob --version`

Launch a node project console
`algob console`



## Contributing

When working on `algob`, we use CLI directly from the build directory using the following command:

    yarn run algob:dev

It will create a `project-dev` directory as a copy of the template project (`sample-project`).
In that directory you should update the `config.algob.js`. The `algob:dev` command will run all `algob` in that directory.

Also, it my be helpful to link the binary:

    yarn link
