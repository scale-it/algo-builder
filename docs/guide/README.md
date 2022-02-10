---
layout: splash
---

# Algo Builder docs

- [API documentation](https://scale-it.github.io/algo-builder/api/algob/index.html)

- [Setup and Requirements](https://github.com/scale-it/algo-builder#requirements))
- [Quick Start](https://github.com/scale-it/algo-builder#quick-start)
- [Configuration](./algob-config.md)
- [Private Net](https://github.com/scale-it/algo-builder/tree/master/infrastructure/README.md) creation
- [Script execution](./user-script-execution.md)
- [Deployer](./deployer.md)
- [Script Checkpoints](./execution-checkpoints.md)
- [Script Logging](./logs.md).
- [Algob Console](./algob-console.md)
- [PyTeal](./py-teal.md)
- [Test TEAL](./testing-teal.md)
- [Templates](./templates.md)
- [Execute Transaction](./execute-transaction.md)
- [Sign Multisig](./sign-multisig.md)
- [Debugging TEAL](./debugging-teal.md)
- [Using algob with WebApp](./algob-web.md)
- [PureStake API](./purestake-api.md)
- [Best Practices](./best-practices.md)

For more in-depth description you can look at the [project specification](https://paper.dropbox.com/published/Algorand-builder-specs--A6Fraxi5VtKhHYbWkTjHfgWyBw-c4ycJtlcmEaRIbptAPqNYS6).


# Contributing

### Development

The project development is open and you can observer a progress through [Pivotal tracker board](https://www.pivotaltracker.com/n/projects/2452320).

### Branch policy

- The active branch is `develop` - all ongoing work is merged into the `develop` branch.
- `master` is the release branch - `develop` is merged into `master` during the release.
- Hot fixes are cherry picked to `master`.

## Working with monorepo

We use **yarn workspaces** to manage all sub packages. here is a list of commands which are helpful in a development workflow

- `yarn workspaces info`
- `yarn workspaces list`
- `yarn workspaces <package-name> <command>`, eg: `yarn workspaces mypkg1 run build` or `yarn workspaces mypkg1 run add --dev react`
- `yarn add algosdk` -- will add `algosdk` to all sub projects (workspaces)

`yarn` does not add dependencies to node_modules directories in either of your packages  –  only at the root level, i.e., yarn hoists all dependencies to the root level. yarn leverages symlinks to point to the different packages. Thereby, yarn includes the dependencies only once in the project.

You have to utilize yarn workspaces’ `noHoist` feature to use otherwise incompatible 3rd party dependencies working in the Mono-Repo environment.

### Testing

Each package has rich test suites. Whenever you add something new make sure you provide a test.

Restarting tests by hand is a bit more time consuming. We are using `mocha` framework to execute tests. It has a very useful feature: `mocha --watch` -- which will monitor for all file changes and re-execute tests when a file changed without adding a time overhead to start node and load all TypeScript modules.

To execute tests in a workspace (eg `packages/runtime`) run:

```
cd packages/runtime
yarn run test
```

To execute and watch tests in a workspace (eg `packages/runtime`) run:

```
cd packages/runtime
yarn run test -w
```

To execute tests in all workspaces, run the following from the root directory:

```
yarn run test
```

To execute and watch tests in all workspaces, run the following from the root directory. Note: it will spawn multiple processes in the same terminal session. So if you want to stop the all processes you can either call `pkill -f mocha` or kill the terminal session.

```
yarn run test:watch
```

NOTE: For the moment test watching in `packages/algob` is not stable because of tear down issues in some test suites. We advise to **not use** test watcher in `packages/algob`.


