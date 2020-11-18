const { createNewNFT, transferNFT, executeTransaction } = require("algob");

exports.executeTransaction = async function (deployer, txnParams) {
    try {
        await executeTransaction(deployer, txnParams);
    } catch (e) {
        console.error('Transaction Failed', e.response.error);
    }
}

exports.createNewNFT = async function (deployer, masterAccount, appId, nft){
    try {
        await createNewNFT(deployer, masterAccount, appId, nft);
    } catch (e) {
        console.error('Transaction Failed', e);
    }
}

exports.transferNFT = async function (deployer, fromAccount, toAccountAddr, appId, nft) {
    try {
        await transferNFT(deployer, fromAccount, toAccountAddr, appId, nft);
    } catch (e) {
        console.error('Transaction Failed', e);
    }
}