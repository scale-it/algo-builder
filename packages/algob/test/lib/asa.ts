import { assert } from "chai";

import { ERRORS } from "../../src/internal/core/errors-list";
import { validateASADefs } from "../../src/lib/asa";
import { Account, ASADefs } from "../../src/types";
import { expectBuilderError } from "../helpers/errors";

const namedAccount: Account = {
  name: "hi",
  addr: "addr",
  sk: new Uint8Array(1)
};

describe("ASA parser", () => {
  it("Should validate correct obj", async () => {
    const valid: ASADefs = {
      A1: {
        total: 1,
        decimals: 0
      }
    };
    const parsed = validateASADefs(valid, new Map<string, Account>(), "");
    assert.deepEqual(parsed, {
      A1: {
        total: 1,
        decimals: 0,
        defaultFrozen: false
      }
    });
  });

  it("Should validate all parameters", async () => {
    const valid = {
      A1: {
        total: 213,
        decimals: 12,
        defaultFrozen: true,
        unitName: "unitName",
        url: "url",
        metadataHash: "metadataHash",
        note: "note",
        noteb64: "noteb64",
        manager: "manager",
        reserve: "reserve",
        freeze: "freeze",
        clawback: "clawback"
      }
    };
    const parsed = validateASADefs(valid, new Map<string, Account>(), "");
    assert.deepEqual(parsed, {
      A1: {
        clawback: "clawback",
        decimals: 12,
        defaultFrozen: true,
        freeze: "freeze",
        manager: "manager",
        metadataHash: "metadataHash",
        note: "note",
        noteb64: "noteb64",
        reserve: "reserve",
        total: 213,
        unitName: "unitName",
        url: "url"
      }
    });
  });

  it("Should check total to be a number", async () => {
    const obj = {
      A1: {
        total: "hi",
        decimals: 0
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>(), ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "total"
    );
  });

  it("Should include filename", async () => {
    const obj = {
      A1: {
        total: "hi",
        decimals: 0
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>(), "SOME_FILENAME"),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "SOME_FILENAME"
    );
  });

  it("Should validate decimals", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 20
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>(), ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "decimals"
    );
  });

  it("Should validate unitName; too long", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 1,
        unitName: "123456789"
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>(), ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "unitName"
    );
  });

  it("Should validate url; too long", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 1,
        // more than 32 bytes:
        url: "1234567890abcdef1234567890abcdef_"
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>(), ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "url"
    );
  });

  it("Should validate metadataHash; too long", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 1,
        // more than 32 bytes:
        metadataHash: "1234567890abcdef1234567890abcdef_"
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>(), ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "metadataHash"
    );
  });

  it("Should check existence of opt-in account name accounts; green path", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 1,
        optInAccNames: ["hi"]
      }
    };
    validateASADefs(obj, new Map<string, Account>([["hi", namedAccount]]), "");
  });

  it("Should check existence of opt-in account name accounts; empty", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 1,
        optInAccNames: []
      }
    };
    validateASADefs(obj, new Map<string, Account>([["hi", namedAccount]]), "");
  });

  it("Should fail if opt-in account doesn't exist", async () => {
    const obj = {
      A1: {
        total: 1,
        decimals: 1,
        optInAccNames: ["hi", "hi123"]
      }
    };
    expectBuilderError(
      () => validateASADefs(obj, new Map<string, Account>([["hi", namedAccount]]), ""),
      ERRORS.SCRIPT.ASA_PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT,
      "hi123"
    );
  });
});
