import { assert } from "chai";

import { ERRORS } from "../../src/internal/core/errors-list";
import { parseASADef } from "../../src/lib/asa";
import { ASADef } from "../../src/types";
import { expectBuilderError } from "../helpers/errors";

describe("ASA parser", () => {
  it("Should validate correct obj", async () => {
    const valid: ASADef = {
      total: 1,
      decimals: 0
    };
    const parsed = parseASADef(valid, "");
    assert.deepEqual(parsed, {
      total: 1,
      decimals: 0,
      defaultFrozen: false
    });
  });

  it("Should validate all parameters", async () => {
    const valid: ASADef = {
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
    };
    const parsed = parseASADef(valid, "");
    assert.deepEqual(parsed, {
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
    });
  });

  it("Should check total to be a number", async () => {
    const obj = {
      total: "hi",
      decimals: 0
    };
    expectBuilderError(
      () => parseASADef(obj, ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "total"
    );
  });

  it("Should include filename", async () => {
    const obj = {
      total: "hi",
      decimals: 0
    };
    expectBuilderError(
      () => parseASADef(obj, "SOME_FILENAME"),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "SOME_FILENAME"
    );
  });

  it("Should validate decimals", async () => {
    const obj = {
      total: 1,
      decimals: 20
    };
    expectBuilderError(
      () => parseASADef(obj, ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "decimals"
    );
  });
  it("Should validate unitName; too long", async () => {
    const obj = {
      total: 1,
      decimals: 1,
      unitName: "123456789"
    };
    expectBuilderError(
      () => parseASADef(obj, ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "unitName"
    );
  });
  it("Should validate url; too long", async () => {
    const obj = {
      total: 1,
      decimals: 1,
      // more than 32B:
      url: "1234567890abcdef1234567890abcdef_"
    };
    expectBuilderError(
      () => parseASADef(obj, ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "url"
    );
  });
  it("Should validate metadataHash; too long", async () => {
    const obj = {
      total: 1,
      decimals: 1,
      // more than 32B:
      metadataHash: "1234567890abcdef1234567890abcdef_"
    };
    expectBuilderError(
      () => parseASADef(obj, ""),
      ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR,
      "metadataHash"
    );
  });
});
