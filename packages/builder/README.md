# Builder

This package provides the main entry point into the application.

## Usage
It can be included as a library by importing `internal/lib/lib.ts` or be run from command line.

### Command line usage

Before running tasks it will check for presence of `builder.config.js` or `builder.config.ts`.
If it's not present the project will be generated in the current directory.
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
