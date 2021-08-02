export function accounts (deployer) {
  return {
    masterAccount: deployer.accountsByName.get('master-account'),
    creatorAccount: deployer.accountsByName.get('john'),
    buyerAccount: deployer.accountsByName.get('bob'),
    managerAcc: deployer.accountsByName.get('alice')
  };
}
