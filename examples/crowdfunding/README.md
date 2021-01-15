# Example Crowdfunding Stateful Smart Contract Application

This project demonstrates how to create a Crowdfunding Stateful Smart Contract Application. It's based on a [tutorial](https://developer.algorand.org/solutions/example-crowdfunding-stateful-smart-contract-application/) from developer.algorand.org/solutions.
To create this type of application on Algorand, there are five steps that must be supported:

- Create the Fund - Anyone should be able to create a fund, setting a begin, end, and closeout dates. The creator and receiver should also be stored. Only creator can modify or delete the smart contract.
    - Update: we need to create an escrow account (contract account - managed through stateless smart contract). It will hold all donations. The escrow account needs to know the crowdfund app ID. So we firstly need to create the app, then we create an escrow account and finally we update the app by setting the escrow address.
We create and update the fund using `scripts/createApp.js`

- Donate - Donations are accepted only between `start` and `end` date. The escrow account holds all donations.
Donations are made using `scripts/transfer/donate.js` _run_ script.

- Withdraw Funds - The fund’s recipient should be able to withdraw the funds from the escrow account after the end date if the fund goal is met.
We claim funds using `scripts/transfer/claim.js`.

- Recover Donations - Original donors should be allowed to recover their donations after the end date if the fund did not make its goal.
To recover donations, we are using `scripts/transfer/reclaim.js`

- Delete Fund - The fund should be deletable by the original creator after the fund close date. It must be accompanied by a closeout transaction from the escrow to the receiver if the escrow contains funds. This gives any unclaimed funds to the receiver of the fund, including non-recovered donations.
To delete fund, we are using `scripts/transfer/delete.js`

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using **PyTEAL**, so make sure to follow the Python3 **setup** described there.

### Run

To Create Crowdfunding Stateful Smart Contract Application

        yarn run algob deploy

To Donate:

        yarn run algob run scripts/transfer/donate.js

To Claim:

        yarn run algob run scripts/transfer/claim.js

To Reclaim:

        yarn run algob run scripts/transfer/reclaim.js

To Delete application and tranfer remaining funds to crreator:

        yarn run algob run scripts/transfer/delete.js

- Some points to be noted:
    - Creator can only claim funds when total goal is reached.
    - Donor can only reclaim funds when total goal is not reached.
    - In this example timestamps are commented because it is possible that private network timestamp and system timestamp may not be in sync.


### Executing test

Crowdfunding app provides TEAL tests which use the Alogrand Builder `algorand-js` Runtime. Tu execute tests:

    yarn run test
