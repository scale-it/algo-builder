# Algo-Builder

Algob is the CLI (Command Line Interface) for Algo Builder. Think about it as an Ethereum Truffle but for Algorand projects.

This package provides a variety of high level functions like, `executeTransaction`, `mkTxParams`, `Deployer`, etc. These functions help in making the development phase of algorand applications easier by acting as a middleware between the developer and `algosdk`.

Please read the main [README](https://github.com/scale-it/algo-builder/blob/master/README.md) file for details about the project and `algob`. This file provides a development description about the `algob` package.

## How to use the API docs?

The best way to find a type, function or something related to a use case is by using the **search field** at the **top** of this page.


## Important links

+ [Home Page](https://scale-it.github.io/algo-builder)
+ [Runtime API Docs](https://scale-it.github.io/algo-builder/api/runtime/index.html)
+ [User Docs](https://scale-it.github.io/algo-builder/guide/README)

## Using algob

`algob` can be included as a library using `yarn add @algo-builder/algob` and then import it using `import * from '@algo-builder/algob'` or can be run from command line as described in the project [README](https://github.com/scale-it/algo-builder/blob/master/README.md) file.

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
