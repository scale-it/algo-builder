# Best Practices

+ Use [boilerplate-stateful-smart-contract](https://developer.algorand.org/docs/features/asc1/stateful/#boilerplate-stateful-smart-contract) as a template for new smart-contracts.
+ Use [zero address](https://developer.algorand.org/docs/features/accounts/#special-accounts) to prevent future updates or deletion of a smart-contract.

### Entry points

Deployment
+ Use the compile endpoint of the Developer API to convert your TEAL source code into the byte string required by the SDKs.
+ Use the `makeApplicationCreate` SDK method types to deploy the initial application.

Interact
+ The user will first interact with the application using the `makeApplicationOptIn` method. After that user can call `makeApplicationNoOpTxn` method to execute logic within the `handle_noop` section of the approval program (see boilerplate template linked above). Calls to other `makeApplication*` type call methods will execute Update, Clear and CloseOut TEAL code section from the boilerplate template.
