const { executeTransaction } = require('algob');
const sha256 = require('js-sha256').sha256;

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e.error);
  }
};

exports.prepareParameters = function (deployer) {
  const bob = deployer.accountsByName.get('bob');
  const alice = deployer.accountsByName.get('alice');
  const secret = 'hero wisdom green split loop element vote belt';
  const secretHash = Buffer.from(sha256.digest(secret)).toString('base64');

  const scTmplParams = { bob: bob.addr, alice: alice.addr, hash_image: secretHash };

  return { alice, bob, secret, scTmplParams, secretHash };
};
