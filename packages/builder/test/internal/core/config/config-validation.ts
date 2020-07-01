import { assert } from "chai";

import { ALGOB_CHAIN_NAME } from "../../../../src/internal/constants";
import {
  getValidationErrors,
  validateConfig,
} from "../../../../src/internal/core/config/config-validation";
import { ERRORS } from "../../../../src/internal/core/errors-list";
import { expectBuilderError } from "../../../helpers/errors";

describe("Config validation", function () {
  describe("paths config", function () {

    const invalidPaths = [
      {paths: 123},  // invalid path type
      {paths: {cache: 123}},
      {paths: {artifacts: 123}},
      {paths: {sources: 123}},
      {paths: {tests: 123}},
      {paths: {root: 123}},
    ]

    it("Should fail with invalid types (paths)", function () {
      for (let cfg of invalidPaths) {
        expectBuilderError(
          () => validateConfig(cfg),
          ERRORS.GENERAL.INVALID_CONFIG,
          undefined,
          JSON.stringify(cfg));
      }
    });

    it("Shouldn't fail with an empty paths config", function () {
      let errors = getValidationErrors({paths: {}});
      assert.isTrue(errors.isEmpty());

      errors = getValidationErrors({});
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

      describe("Algob Chain network config", function () {
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
                    chainName: 123,
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

          it("Shouldn't fail if no url is set for algob-chain network", function () {
            const errors = getValidationErrors({
              networks: { [ALGOB_CHAIN_NAME]: {} },
            });
            assert.isTrue(errors.isEmpty(), errors.toString());
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

        });

        describe("Other fields", function () {
          it("Shouldn't accept invalid types", function () {
            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      chainName: "",
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
            chainName: "testnet",
            from: "0x0001",
            url: "purestake.com:80",
          },
          [ALGOB_CHAIN_NAME]: {
            // accounts: [{ privateKey: "asd", balance: "123" }],
          },
          localhost: {
            url: "localhost:8080",
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
          },
          unknown: {
            asd: 123,
            url: "localhost:8080",
          },
        }).errors,
        []
      );
    });

    it("Shouldn't fail with unrecognized params", function () {
      const errors = getValidationErrors({
        networks: {
          localhost: {
            url: "localhost:8080",
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
