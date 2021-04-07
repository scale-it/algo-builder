## Example

We will create a simple stateful smart contract which will:
- Have a global variable `counter`
- Will increment `counter` each time we call the application.

## Steps

+ Create a file with Approval Program
+ Create a file with Clear program
+ Deploy New Application
+ Opt-In to Application
+ Call Application
+ Update Application
+ Delete Application

# 1. Create a file with Approval Program

We will create a approval program which has global `counter` and it is incremented when we call the application. Put the code below in `/assets/approval_program.teal`:

```
#pragma version 2

// read global state
byte "counter"
dup
app_global_get

// increment the value
int 1
+

// store to scratch space
dup
store 0

// update global state
app_global_put

// load return value as approval
load 0
return

```

This program has a single global key/value pair to store the number of times the program was called. The key is the string "counter" and the value will be defined as an integer when the application is created.


# 2. Create a file with Clear Program

Now, we will create clear program. This program does not evaluate any conditions and simply approves the call. Put the code below in `/assets/clear_program.teal`:

```
#pragma version 2

int 1
return
```

# 3. Deploy New Application

To deploy the contract use the following code in a new file named `deploy.js` in `scripts` folder of your project directory:

### Create user accounts

```javascript
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('alice');

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: creatorAccount.addr,
    amountMicroAlgos: 200000000,
    payFlags: {}
  };
  // transfer some algos to creator account
  await executeTransaction(deployer, algoTxnParams);
```

In the code above we declare user accounts and fund `creatorAccount` account. `masterAccount` is the default account used in algob private net.

### Deploy stateful contract

Firstly we need to put some money into the contract. `master` account will fund it:

```javascript
  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  const sscInfo = await deployer.deploySSC(
    'approval_program.teal', // approval program
    'clear_program.teal', // clear program
    {
      sender: creatorAccount,
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1
    }, {});

  console.log(sscInfo);
```

Parameters passed are:
  - Approval Program
  - Clear Program
  - SSC(stateful smart contract) arguments which includes sender and details for storage usage.
  - Transaction parameters

- In above code we have deployed a new application.

- After deploying application you will get the following information on your terminal:

```
Created new app-id: 189
{
  creator: 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY',
  txId: 'BCP3ZKT26K2BEB475OMKQHOMBEFVWEHESRS3XMAWQEVASFP6JFUA',
  confirmedRound: 13899,
  appID: 189
}

```

# 4. Opt-In to Application

To Opt-In to an application use the following code in one of your scripts (in `./scripts`):

```javascript
	await deployer.optInToSSC(Account, applicationID, {}, {});
```

where `Account` is the account you want to opt-in and applicationID is application index.

# 5. Call Application

To call an application use the following code in one of your scripts (in `./scripts`):

```javascript
	const tx = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      appId: applicationID,
      payFlags: {}
    }

    await executeTransaction(deployer, tx);
```

In `tx` there are following parameters:
  - we set the type which is `CallNoOpSSC` - Call to stateful smart contract
  - set the sign to SecretKey
  - provide fromAccount details
  - provide application index of SSC
  - provide payment flags. If any (fee, firstValid, lastvalid etc)

Calling application each time will increase the stateful counter by 1.
To view the global state of the application you can use the following code:

```
  // Retreive Global State
  let globalState = await readGlobalStateSSC(deployer, creatorAccount.addr, applicationID);
  console.log(globalState);
```

Output:

```
[ { key: 'Y291bnRlcg==', value: { bytes: '', type: 2, uint: 2 } } ]
[ { key: 'Y291bnRlcg==', value: { bytes: '', type: 2, uint: 3 } } ]
```

here key 'Y291bnRlcg==' is converted form of `counter`.

# 6. Update Application

To update application you can use:

```javascript
const updatedRes = await updateSSC(
    deployer,
    creatorAccount,
    {}, // pay flags
    applicationID,
    'new_approval.teal',
    'new_clear.teal',
    {}
  );
console.log('Application Updated: ', updatedRes);
```

# 7. Delete Application

To delete application you can use:

```javascript
	const tx = {
      type: types.TransactionType.DeleteSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      appId: applicationID,
      payFlags: {},
      appArgs: []
    }

    await executeTransaction(deployer, tx);
```

