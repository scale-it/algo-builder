
async function main() {
  console.log("Apache was set up correctly!")
}

main()
  .then(() => process.exit(process.exitCode))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

