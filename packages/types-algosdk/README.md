# Summary

This package contains type definitions for [js-algorand-sdk](https://github.com/algorand/js-algorand-sdk)


By default all visible ”@types” packages are included in your compilation. Packages in node_modules/@types of any enclosing folder are considered visible.

To include this typing `typeRoots` needs to be specified, only packages under typeRoots will be included.

```
{
  "compilerOptions": {
    "typeRoots": ["node_modules/@types", "node_modules/@algorand-builder/types-algosdk"]
  }
}
```