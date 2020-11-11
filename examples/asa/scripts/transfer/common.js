const { transferMicroAlgosLsig, transferASALsig } = require("algob");

exports.transferAlgo = async function (deployer, senderAddr, receiverAddr, amount, lsig){
    try {
        const details = await transferMicroAlgosLsig(deployer, senderAddr, receiverAddr, amount, lsig, {});
        console.log(details);
    } catch (e) {
        console.error('Transaction Failed', e.response.error);
    }
}   

exports.transferASA = async function (deployer, senderAccount, receiverAddr, amount, assetID, lsig){
    try {
        const details = await transferASALsig(deployer, senderAccount, receiverAddr, amount, assetID, lsig);
        console.log(details);
    } catch (e) {
        console.error('Transaction Failed', e.response.error);
    }
}
