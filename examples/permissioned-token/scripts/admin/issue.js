const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { executeTransaction, fundAccount, totalSupply } = require('../common/common');
const accounts = require('../common/accounts');

/**
 * Issue tokens using the issuer account.
 */
async function issue (deployer, address, amount) {
  const issuer = deployer.accountsByName.get(accounts.issuer);
  const tesla = deployer.asa.get('tesla');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  const escrowParams = {
    TOKEN_ID: tesla.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback.py', escrowParams);
  const escrowAddress = escrowLsig.address();

  const issuanceParams = [
    /*
     * tx 0 - Call to controller stateful smart contract with application arg: 'issue'
     * The 'issue' branch ensures that sender is the token reserve and token is not killed
     * Issuance tx will be rejected if token has been killed by the manager
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: issuer,
      appID: controllerSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:issue'],
      foreignAssets: [tesla.assetIndex]
    },
    /*
     * tx 1 - Asset transfer transaction from Token Reserve -> address. This tx is executed
     * and approved by the clawback escrow (since the asset is default frozen only clawback can move funds).
     * This tx doesn't need rule checks (as this is an issuance txn)
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: escrowAddress,
      recipient: address,
      assetID: tesla.assetIndex,
      revocationTarget: issuer.addr, // tx will fail if assetSender is not token reserve address
      amount: amount,
      lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    }
  ];
  console.log(`* Issuing ${amount} tokens to [${address}] *`);
  await executeTransaction(deployer, issuanceParams);

  console.log(`* ${address} asset holding: *`);
  await balanceOf(deployer, address, tesla.assetIndex); // print asset holding

  const supply = await totalSupply(deployer, tesla.assetIndex);
  console.log(`Total Supply of token 'tesla': ${supply}`);
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  await fundAccount(deployer, elon); // fund elon

  // opt-in asa to account first (skip if opted-in already)
  console.log(`* Opt-In ASA tesla for ${elon.name} *`);
  await deployer.optInAcountToASA('tesla', elon.name, {});
  console.log('* Opt-In Successful *');

  // use below function to whitelist elon
  // await whitelist(deployer, alice, elon.addr);

  // issue (mint) 15 tokens to elon from reserve
  await issue(deployer, elon.addr, 15);
}

module.exports = { default: run, issue: issue };
