const { executeTransaction, readAppGlobalState, readAppLocalState } = require('@algo-builder/algob');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

exports.printGlobalNFT = async function (deployer, creator, appID) {
  try {
    const globalState = await readAppGlobalState(deployer, creator, appID);
    for (const g of globalState) {
      const key = Buffer.from(g.key, 'base64').toString();
      if (key === 'total') {
        console.log('Global NFT Count:', g.value.uint);
      }
    }
  } catch (e) {
    console.error('Error Occurred', e);
  }
};

exports.printLocalNFT = async function (deployer, account, appID) {
  try {
    const localState = await readAppLocalState(deployer, account, appID);
    // each nft is stored as a one record in user store
    let holdings = [];
    if (localState === undefined) {
      holdings = 'none';
    } else {
      for (const l of localState) {
        const key = Buffer.from(l.key, 'base64').readBigUInt64BE();
        holdings.push(key);
      }
      holdings = holdings.join(' ');
    }
    console.log('%s account holds app(%s) NFTs: ', account, appID, holdings);
  } catch (e) {
    console.error('Error Occurred', e);
  }
};
