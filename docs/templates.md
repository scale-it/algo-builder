# Distributed Application Templates

Distributed Applications (dApps) are basically decentralized applications. The templates can be found [here](https://github.com/scale-it/algo-builder-templates) and are extremely helpful and easy to use. They are designed and implemented in such a way that they can provide the aspiring developers a headstart in building dApps based on `Algorand Blockchain`. The templates heavily use [algosdk](https://github.com/algorand/js-algorand-sdk), [algo-builder](https://github.com/scale-it/algo-builder) and [AlgoSigner](https://github.com/PureStake/algosigner).

## Usage

An `algob` project and an `react` frontend are encapsulated in each template. Deployment information is stored in `checkpoints` (in `/artifacts`) from which user can import information directly (loading `.yaml` file in react-app).

The templates can be easily imported or unboxed using the `algob unbox-template` command. 

After successfully unboxing the template, please link the `algob` package in the template directory to use it for running scripts.


## Quick Start

`algob unbox-template <template-name> <destination-directory> --force (flag)`
 - if `destination-directory` is not passed then current directory will be used.
 - if `template-name` is not passed, then by default template "/default" is unboxed.
 - if `--force` is passed, then files are overwritten. If it isn't passed, then user is made to choose whether to overwrite those files or not.
 - if `template-name` passed is not present as an existing template, the command provides an interactive way to choose from the existing templates.
 - The command also asks if the user wants to install the dependencies as a part of the current process.



