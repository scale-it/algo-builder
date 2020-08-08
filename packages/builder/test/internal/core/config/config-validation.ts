import { assert } from "chai";

import { ALGOB_CHAIN_NAME } from "../../../../src/internal/constants";
import {
  getValidationErrors,
  validateConfig
} from "../../../../src/internal/core/config/config-validation";
import { ERRORS } from "../../../../src/internal/core/errors-list";
import { expectBuilderError } from "../../../helpers/errors";
import { account1 } from "../../../mocks/account";

const accountStatic = {
  addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
  sk: new Uint8Array([28, 45, 45, 15, 70, 188, 57, 228, 18, 21, 42, 228, 33, 187, 222, 162, 89, 15, 22, 52, 143, 171, 182, 17, 168, 238, 96, 177, 12, 163, 243, 231, 160, 203, 241, 203, 176, 185, 4, 26, 16, 101, 217, 179, 83, 157, 119, 28, 82, 234, 204, 209, 249, 29, 28, 24, 97, 122, 116, 86, 135, 163, 236, 253]) // eslint-disable-line max-len
};

describe("Config validation", function () {
  describe("paths config", function () {
    const invalidPaths = [
      { paths: 123 }, // invalid path type
      { paths: { cache: 123 } },
      { paths: { artifacts: 123 } },
      { paths: { sources: 123 } },
      { paths: { tests: 123 } },
      { paths: { root: 123 } }
    ];

    it("Should fail with invalid types (paths)", function () {
      for (const cfg of invalidPaths) {
        expectBuilderError(
          () => validateConfig(cfg),
          ERRORS.GENERAL.INVALID_CONFIG,
          undefined,
          JSON.stringify(cfg));
      }
    });

    it("Shouldn't fail with an empty paths config", function () {
      let errors = getValidationErrors({ paths: {} });
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
          tests: "tests"
        }
      });

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail with unrecognized params", function () {
      const errors = getValidationErrors({
        paths: {
          unrecognized: 123
        }
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
                  asd: 123
                }
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
                  [ALGOB_CHAIN_NAME]: 123
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    chainName: 123
                  }
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    throwOnCallFailures: "a"
                  }
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    throwOnTransactionFailures: "a"
                  }
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    loggingEnabled: 123
                  }
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    loggingEnabled: "a"
                  }
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );

          // Non string initialDate
          expectBuilderError(
            () =>
              validateConfig({
                networks: {
                  [ALGOB_CHAIN_NAME]: {
                    initialDate: 123
                  }
                }
              }),
            ERRORS.GENERAL.INVALID_CONFIG
          );
        });
      });

      describe("HTTP network config", function () {
        describe("Host field", function () {
          it("Should fail if no host is set for custom networks", function () {
            expectBuilderError(
              () => validateConfig({ networks: { custom: {} } }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });

          it("Shouldn't fail if no host is set for algob-chain network", function () {
            const errors = getValidationErrors({
              networks: { [ALGOB_CHAIN_NAME]: {} }
            });
            assert.isTrue(errors.isEmpty(), errors.toString());
          });
        });

        describe("port", function () {
          it("Should be optional", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  host: "http://localhost",
                  token: "somefaketoken"
                }
              }
            });
            assert.isEmpty(errors.errors);
          });

          it("Should fail if not a number ", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  host: "http://localhost",
                  port: "1234",
                  token: "somefaketoken"
                }
              }
            });
            assert.isNotEmpty(errors.toString());
            assert.match(errors.toString(), /Expected a value of type HttpNetworkConfig/);
          });
        });

        describe("token", function () {
          it("Is required", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  host: "http://localhost"
                }
              }
            });
            assert.match(errors.toString(), /config.networks.custom.token - Expected a value of type string/);
          });
        });

        describe("HttpHeaders", function () {
          it("Should be optional", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  host: "http://localhost",
                  token: "somefaketoken"
                }
              }
            });
            assert.isTrue(errors.isEmpty());
          });

          it("Should accept a mapping of strings to strings", function () {
            const errors = getValidationErrors({
              networks: {
                custom: {
                  host: "http://localhost",
                  port: 123,
                  token: "somefaketoken",
                  httpHeaders: {
                    a: "asd",
                    b: "a"
                  }
                }
              }
            });
            assert.isTrue(errors.isEmpty(), JSON.stringify(errors));
          });

          it("Should reject other types", function () {
            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      host: "http://localhost",
                      httpHeaders: 123
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      host: "http://localhost",
                      httpHeaders: "123"
                    }
                  }
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
                      host: "http://localhost",
                      httpHeaders: {
                        a: "a",
                        b: 123
                      }
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    custom: {
                      host: "http://localhost",
                      httpHeaders: {
                        a: "a",
                        b: false
                      }
                    }
                  }
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
                      host: ""
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      accounts: {},
                      host: ""
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      accounts: { asd: 123 },
                      host: ""
                    }
                  }
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
                          mnemonic: 123
                        },
                        host: ""
                      }
                    }
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );

              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          initialIndex: "asd"
                        },
                        host: ""
                      }
                    }
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );

              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          count: "asd"
                        },
                        host: ""
                      }
                    }
                  }),
                ERRORS.GENERAL.INVALID_CONFIG
              );

              expectBuilderError(
                () =>
                  validateConfig({
                    networks: {
                      asd: {
                        accounts: {
                          path: 123
                        },
                        host: ""
                      }
                    }
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
                          type: 123
                        },
                        host: ""
                      }
                    }
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
                        host: ""
                      }
                    }
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
                      host: ""
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      from: 123,
                      host: ""
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );

            expectBuilderError(
              () =>
                validateConfig({
                  networks: {
                    asd: {
                      host: false
                    }
                  }
                }),
              ERRORS.GENERAL.INVALID_CONFIG
            );
          });
        });
      });
    });

    it("Shouldn't fail with an empty networks config", function () {
      const errors = getValidationErrors({
        networks: {}
      });

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail without a networks config", function () {
      const errors = getValidationErrors({});

      assert.isTrue(errors.isEmpty());
    });

    it("Shouldn't fail with valid networks configs", function () {
      let errors = getValidationErrors({
        networks: {
          commonThings: {
            accounts: [],
            chainName: "testnet",
            from: "0x0001",
            host: "purestake.com",
            port: 80,
            token: "somefaketoken"
          },
          [ALGOB_CHAIN_NAME]: {
            accounts: [account1]
          },
          localhost: {
            accounts: [accountStatic],
            host: "localhost",
            port: 8080,
            token: "somefaketoken"
          }
        }
      });

      assert.isEmpty(errors.errors, errors.toString());

      errors = getValidationErrors({
        networks: {
          custom: {
            host: "http://localhost:8123",
            port: 8123,
            token: "somefaketoken"
          }
        },
        unknown: {
          asd: 123,
          host: "localhost",
          port: 8080,
          token: "somefaketoken"
        }
      });
      assert.isEmpty(errors.errors, errors.toString());
    });

    it("Shouldn't fail with unrecognized params", function () {
      const errors = getValidationErrors({
        networks: {
          localhost: {
            host: "localhost",
            port: 8080,
            token: "somefaketoken",
            asd: 1232
          },
          [ALGOB_CHAIN_NAME]: {
            asdasd: "123"
          }
        }
      });

      assert.isTrue(errors.isEmpty(), errors.toString());
    });
  });
});
