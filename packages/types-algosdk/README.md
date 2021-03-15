# Summary

This package contains type definitions for [js-algorand-sdk](https://github.com/algorand/js-algorand-sdk)

## Usage

By default, the TypeScript compiler searches for type definitions in
* all packages discoverable (node [modules](https://docs.npmjs.com/cli/v6/configuring-npm/folders#node-modules): `./node_modules`) under  ”@types” organization (eg `node_modules/@types` of any enclosing folder are considered visible).
* local `*d.ts` files
* all subpackages defined `tsconfig.compilerOptions.typeRoots`.

To use this package in a Typescript you have to update your `tsconfig.json` file. The `typeRoots` attribute must be  updated:


```
{
  "compilerOptions": {
    "typeRoots": ["node_modules/@types", "node_modules/@algo-builder/types-algosdk"]
  }
}
```
All paths are relative to the `tsconfig.json`.
