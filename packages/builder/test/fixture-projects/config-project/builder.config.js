
task("example2", "example task", async (ret) => 28);

task("example", "example task", async (__, { run }) => run("example2"));

module.exports = {
  networks: {
    custom: {
      url: "http://localhost:8545",
    },
    localhost: {
      url: "localhost",
    },
  }
};
