# Deployer

- [Algorand Standard Assets(ASA)](https://developer.algorand.org/docs/features/asa/):

  - `deployASA` : Function to deploy Algorand Standard Assets(ASA) 
    - Parameters: 

          assetName: Asset name 
          flags: ASADeploymentFlags

    - Example:

          const asaInfo = await deployer.deployASA("vote-token", {
            creator: votingAdminAccount});
        
          console.log(asaInfo);

  - `TransferAsset`: To transfer Asset, you can use `executeTransaction`. 
    - Example:

          await executeTransaction(deployer, {
            type: TransactionType.TransferAsset,
            sign: SignType.SecretKey,
            fromAccount: goldOwnerAccount, 
            toAccountAddr: johnAccount.addr, 
            amount: 1,
            assetID: goldAssetID,
            payFlags: {}
          });


- [Stateful Smart Contracts(SSC)](https://developer.algorand.org/docs/features/asc1/stateful/):

    - `deploySSC` : Function to deploy stateful smart contracts.
      - Parameters:
            
            approvalProgram: filename which has approval program
            clearProgram: filename which has clear program
            flags: SSCDeploymentFlags
            payFlags: Transaction Params
    
        Note: `Approval` and `Clear` program must be present in `assets/` directory.`

      - Example:

            const res = await deployer.deploySSC(
              "approval-program.py", "clear-program.py", {
                sender: votingAdminAccount, 
                localInts: 0,
                localBytes: 1, 
                globalInts: 6, 
                globalBytes: 1, 
                appArgs: appArgs
              }, {});

            console.log(res);

    - `OptInToSSC` : Accounts use this transaction to opt in to the smart contract to participate (local storage usage).
      - Parameters:

            sender: sender account
            appID: application index
            payFlags: Transaction flags
            appArgs: Application Args(Optional)

      - Example:

            await deployer.OptInToSSC(aliceAccount, appID, {});

    - `update` : Function to update existing SSC. 
      - Example:

            const { update } = require("algob");

            const res = await update(deployer,  votingAdminAccount,
              {}, appId,
              "newApprovalProgram",
              "newClearProgram.teal"
            );
            console.log(res);

    - To interact with SSC, you can use `executeTransaction` with following type:
      - `TransactionType`: `CallNoOpSSC`, `DeleteSSC`, `CloseSSC`, `ClearSSC` 

      - `CallNoOpSSC`: Generic application calls to execute the ApprovalProgram

            const txnParam: {
              type: TransactionType.CallNoOpSSC, 
              sign: SignType.SecretKey, 
              fromAccount: aliceAccount,
              appId: appInfo.appID, 
              payFlags: {},
              appArgs: appArgs // optional
            }

            await executeTransaction(deployer, txnParam);

      - `DeleteSSC`: Transaction to delete the application.

            await executeTransaction(deployer, {
              type: TransactionType.DeleteSSC, 
              sign: SignType.SecretKey, 
              fromAccount: aliceAccount,
              appId: appInfo.appID, 
              payFlags: {},
            });

      - `CloseSSC`: Accounts use this transaction to close out their participation in the contract. This call can fail based on the TEAL logic, preventing the account from removing the contract from its balance record.

            await executeTransaction(deployer, {
              type: TransactionType.CloseSSC, 
              sign: SignType.SecretKey, 
              fromAccount: aliceAccount,
              appId: appInfo.appID, 
              payFlags: {},
            });

      - `ClearSSC`: Similar to CloseOut, but the transaction will always clear a contract from the account’s balance record whether the program succeeds or fails.

            await executeTransaction(deployer, {
              type: TransactionType.ClearSSC, 
              sign: SignType.SecretKey, 
              fromAccount: aliceAccount,
              appId: appInfo.appID, 
              payFlags: {},
            });
