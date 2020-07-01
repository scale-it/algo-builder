import { assert } from "chai";

import { ALGOB_CHAIN_NAME } from "../../../../src/internal/constants";
import {
  getValidationErrors,
  validateConfig,
} from "../../../../src/internal/core/config/config-validation";
import { ERRORS } from "../../../../src/internal/core/errors-list";
import { expectBuilderError } from "../../../helpers/errors";
import CfgErrors from "../../../../src/internal/core/config/config-errors";

describe("Config validation", function () {
  describe("default network config", function () {
    it("Should fail if the wrong type is used", function () {
      expectBuilderError(
        () => validateConfig({ defaultNetwork: 123 }),
        ERRORS.GENERAL.INVALID_CONFIG
      );
    });
  });

  describe("paths config", function () {
    const invalidPathsType = {
      paths: 123,
    };

    const invalidCacheType = {
      paths: {
        cache: 123,
      },
    };

    const invalidArtifactsType = {
      paths: {
        artifacts: 123,
      },
    };

    const invalidSourcesType = {
      paths: {
        sources: 123,
      },
    };

    const invalidTestsType = {
      paths: {
        tests: 123,
      },
    };

    const invalidRootType = {
      paths: {
        root: 123,
      },
    };

    it("Should fail with invalid types (paths)", function () {
      expectBuilderError(
        () => validateConfig(invalidPathsType),
        ERRORS.GENERAL.INVALID_CONFIG
      );

      expectBuilderError(
        () => validateConfig(invalidCacheType),
        ERRORS.GENERAL.INVALID_CONFIG
      );

      expectBuilderError(
        () => validateConfig(invalidArtifactsType),
        ERRORS.GENERAL.INVALID_CONFIG
      );

      expectBuilderError(
        () => validateConfig(invalidRootType),
        ERRORS.GENERAL.INVALID_CONFIG
      );

      expectBuilderError(
        () => validateConfig(invalidSourcesType),
        ERRORS.GENERAL.INVALID_CONFIG
      );

      expectBuilderError(
        () => validateConfig(invalidTestsType),
        ERRORS.GENERAL.INVALID_CONFIG
      );
    });

    it("Shouldn't fail with an empty paths config", function () {
      const errors = getValidationErrors({
        paths: {},
      });

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail without a paths config", function () {
      const errors = getValidationErrors({});

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail with valid paths configs", function () {
      const errors = getValidationErrors({
        paths: {
          root: "root",
          cache: "cache",
          artifacts: "artifacts",
          sources: "sources",
          tests: "tests",
        },
      });

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail with unrecognized params", function () {
      const errors = getValidationErrors({
        paths: {
          unrecognized: 123,
        },
      });

      assert.isTrue(errors.isEmpty());
    });
  });

  describe("networks config", function () {
    describe("Invalid types", function () {
      describe("Networks object", function () {
        it("Should fail with invalid types (networks)", function () {
          expectBuilderError(
            () => validateConfig({ networks: 123 }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  asd: 123,
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );
        });
      });

      describe("Builder's network config", function () {
        it("Should fail with invalid types", function () {
          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: 123,
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    chainId: "asd",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    hardfork: "not-supported",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    throwOnCallFailures: "a",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    throwOnTransactionFailures: "a",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    from: 123,
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    gas: "asdasd",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    gasPrice: "6789",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    gasMultiplier: "123",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    blockGasLimit: "asd",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    accounts: 123,
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    accounts: [{}],
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    accounts: [{ privateKey: "" }],
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    accounts: [{ balance: "" }],
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    accounts: [{ privateKey: 123 }],
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    accounts: [{ balance: 213 }],
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    loggingEnabled: 123,
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    loggingEnabled: "a",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          // Non boolean allowUnlimitedContractSize
          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    allowUnlimitedContractSize: "a",
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          // Non string initialDate
          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    initialDate: 123,
                  },
                },
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );
        });
      });

      describe("HTTP network config", function () {
        describe("Url field", function () {
          it("Should fail if no url is set for custom networks", function () {
            expectBuilderError(
              () => validateConfig({ networks: { custom: {} } }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });

          it("Shouldn't fail if no url is set for localhost network", function () {
            const errors = getValidationErrors({ networks: { localhost: {} } });
            assert.isTrue(errors.isEmpty());
          });

          it("Shouldn't fail if no url is set for builder network", function () {
            const errors = getValidationErrors({
              networks: { [ALGOB_CHAIN_NAME]: {} },
            });
            assert.isTrue(errors.isEmpty());
          });
        });

        describe("HttpHeaders", function () {
          it("Should be optional", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  url: "http://localhost",
                },
              },
            });
            assert.isTrue(errors.isEmpty());
          });

          it("Should accept a mapping of strings to strings", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  url: "http://localhost",
                  httpHeaders: {
                    a: "asd",
                    b: "a",
                  },
                },
              },
            });
            assert.isTrue(errors.isEmpty());
          });

          it("Should reject other types", function () {
            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      url: "http://localhost",
                      httpHeaders: 123,
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      url: "http://localhost",
                      httpHeaders: "123",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });

          it("Should reject non-string values", function () {
            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      url: "http://localhost",
                      httpHeaders: {
                        a: "a",
                        b: 123,
                      },
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      url: "http://localhost",
                      httpHeaders: {
                        a: "a",
                        b: false,
                      },
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });
        });

        describe("Accounts field", function () {
          it("Shouldn't work with invalid types", function () {
            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      accounts: 123,
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      accounts: {},
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      accounts: { asd: 123 },
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });

          describe("HDAccounstConfig", function () {
            it("Should fail with invalid types", function () {
              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          mnemonic: 123,
                        },
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );

              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          initialIndex: "asd",
                        },
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );

              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          count: "asd",
                        },
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );

              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          path: 123,
                        },
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );
            });
          });

          describe("OtherAccountsConfig", function () {
            it("Should fail with invalid types", function () {
              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          type: 123,
                        },
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );
            });
          });

          describe("List of private keys", function () {
            it("Shouldn't work with invalid types", function () {
              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: [123],
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );
            });
          });

          describe("Remote accounts", function () {
            it("Should work with accounts: remote", function () {
              assert.isTrue(
                getValidationErrors({
                  networks: {
                    asd: {
                      accounts: "remote",
                      url: "",
                    },
                  },
                }).isEmpty()
              );
            });

            it("Shouldn't work with other strings", function () {
              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: "asd",
                        url: "",
                      },
                    },
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );
            });
          });
        });

        describe("Other fields", function () {
          it("Shouldn't accept invalid types", function () {
            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      chainId: "",
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      from: 123,
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      gas: "asdsad",
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      gasPrice: "asdsad",
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      gasMultiplier: "asdsad",
                      url: "",
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      url: false,
                    },
                  },
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });
        });
      });
    });

    it("Shouldn't fail with an empty networks config", function () {
      const errors = getValidationErrors({
        networks: {},
      });

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail without a networks config", function () {
      const errors = getValidationErrors({});

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail with valid networks configs", function () {
      const errors = getValidationErrors({
        networks: {
          commonThings: {
            chainId: 1,
            from: "0x0001",
            gas: "auto",
            gasPrice: "auto",
            gasMultiplier: 123,
            url: "",
          },
          [ALGOB_CHAIN_NAME]: {
            gas: 678,
            gasPrice: 123,
            blockGasLimit: 8000,
            accounts: [{ privateKey: "asd", balance: "123" }],
          },
          localhost: {
            gas: 678,
            gasPrice: 123,
            url: "",
          },
          withRemoteAccounts: {
            accounts: "remote",
            url: "",
          },
          withPrivateKeys: {
            accounts: ["0x0", "0x1"],
            url: "",
          },
          withHdKeys: {
            accounts: {
              mnemonic: "asd asd asd",
              initialIndex: 0,
              count: 123,
              path: "m/123",
            },
            url: "",
          },
          withOtherTypeOfAccounts: {
            accounts: {
              type: "ledger",
              asd: 12,
            },
            url: "",
          },
        },
      });

      assert.deepEqual(errors.errors, []);

      assert.deepEqual(
        getValidationErrors({
          networks: {
            custom: {
              url: "http://localhost:8545",
            },
            localhost: {
              accounts: [
                "0xa95f9e3e7ae4e4865c5968828fe7c03fffa8a9f3bb52d36d26243f4c868ee166",
              ],
            },
          },
          unknown: {
            asd: 123,
            url: "",
          },
        }).errors,
        []
      );
    });

    it("Shouldn't fail with unrecognized params", function () {
      const errors = getValidationErrors({
        networks: {
          localhost: {
            asd: 1232,
          },
          [ALGOB_CHAIN_NAME]: {
            asdasd: "123",
          },
        },
      });

      assert.isTrue(errors.isEmpty());
    });
  });
});
