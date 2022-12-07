# Script argument example

This example demonstrates how user can pass arguments to script.

The format for passing arguments:

`yarn algob script.js --arg '<JSON-String>'`

First, deploy the application which will give us the application ID:

`yarn algob deploy`

Pass the application ID received above as argument to script:

`yarn algob run scripts/run/optin_application.js --arg '{"appID":"<application-ID-you-got-above>"}'`
