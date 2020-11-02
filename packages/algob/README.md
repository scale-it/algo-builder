# Builder

This package provides the main entry point into the application.

Please read the main [README](../../README.md) file for details about the project and `algob`. This file provides a development description about the `algob` package.

## Usage


`algob` can be included as a library by importing `internal/lib/lib.ts` or can be run from command line as described in the project [README](../../README.md) file.

### Command line usage

`algob` always starts for checking and loading `algob.config.js` file.
If the config is not present, then it will be generated in the current directory.
After that other commands will be possible to execute.

Help
`algob help`

View version
`algob --version`

Launch a node project console
`algob console`

### Development-mode usage

Copied files won't overwrite already existing ones so running `yarn algob` should result in an error if any files clash.
It's best to use a different directory to initialize test projects.

Also, it my be helpful to link the binary:

    yarn link

## Contributing

When working on `algob`, we use CLI directly from the build directory using the following command:

    yarn run algob:dev

It will create a `project-dev` directory as a copy of the template project (`sample-project`).
In that directory you should update the `config.algob.js`. The `algob:dev` command will run all `algob` in that directory.
