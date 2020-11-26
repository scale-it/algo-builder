const { executeTransaction, readGlobalStateSSC, readLocalStateSSC } = require("algob");

exports.executeTransaction = async function (deployer, txnParams) {
    try {
        await executeTransaction(deployer, txnParams);
    } catch (e) {
        console.error('Transaction Failed', e.response.error);
    }
}

exports.printGlobalNFT = async function (deployer, creator, appId) {
    try {
        const globalState = await readGlobalStateSSC(deployer, creator, appId);
        for(const g of globalState){
            const key = Buffer.from(g.key, 'base64').toString();
            if(key === 'total'){
                console.log('Global NFT Count:', g.value.uint);
            }
        }
    } catch (e) {
        console.error('Error Occurred', e);
    }
}

exports.printLocalNFT = async function (deployer, account, appId) {
    try {
        const localState = await readLocalStateSSC(deployer, account, appId);
        let count = 0;

        // length/2 because each nft is a pair of {id: ref_data, id_h: ref_hash}
        if(localState !== undefined){ 
            count = localState.length/2; 
        }
        console.log('NFT balance of', account, ':', count); 
    } catch (e) {
        console.error('Error Occurred', e);
    }
}
