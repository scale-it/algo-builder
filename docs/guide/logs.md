---
layout: splash
---

# Logs

Algo Builder project logs the transaction details while deploying ASA and ASC.

It offers a `log` function for user too. You can use this function to log anything from your deployment script.

You can also use this in your interaction script.

# Usage

`deployer.log(msg: string, obj: any);`

You can use this line in any of your scripts to log anything.

Log files are stored in `artifacts/scripts/` folder.

* Log files are created in given format:  `artifacts/scripts/<script_path_and_name>-<timestamp>.log`
* Log file structure:
    ```
    message content:
            object content
    ```
