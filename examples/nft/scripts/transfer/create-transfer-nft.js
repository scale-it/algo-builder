const { createNewNFT, transferNFT } = require("./common");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account"); // Seller
  const bobAccount = deployer.accountsByName.get("bob-account"); // Buyer

  const sscInfo = await deployer.getSSC("approval_program.teal", "clear_state_program.teal");
  const appId = sscInfo.appID;
  console.log(sscInfo);

  //create new non-fungible-token (only smart contract admin can do it)
  await createNewNFT(deployer, masterAccount, appId, { name: "nft-1" });
  await createNewNFT(deployer, masterAccount, appId, { name: "nft-2" });

  //Fails as john is not the smart contract admin
  await createNewNFT(deployer, johnAccount, appId, { name: "nft-3" });

  //transfer non-fungible token from one account (must be holder of nft) to another 
  // (both accounts must opt-in to the smart contract)
  await transferNFT(deployer, masterAccount, johnAccount.addr, appId, { name: "nft-1" });

  //transfer nft-2 from master -> john
  await transferNFT(deployer, masterAccount, johnAccount.addr, appId, { name: "nft-2" });
  //then transfer the same nft from john -> bob
  await transferNFT(deployer, johnAccount, bobAccount.addr, appId, { name: "nft-2" });
}

module.exports = { default: run }