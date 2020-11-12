const { transferMicroAlgosLsig } = require("algob");

exports.transferAlgo = async function (deployer, senderAddr, receiverAddr, amount, lsig){
    try {
        const details = await transferMicroAlgosLsig(deployer, senderAddr, receiverAddr, amount, lsig, {});
        console.log(details);
    } catch (e) {
        console.error('Transaction Failed', e.response.error);
    }
}