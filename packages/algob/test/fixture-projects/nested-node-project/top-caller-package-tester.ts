import { getClosestCallerPackage } from "../../../src/internal/util/caller-package";
import {
  call as callFromNested,
  callFromTopModule as nestedCallFromTopModule
} from "./project/nested-caller-package-tester";

export function call (): string | undefined {
  return getClosestCallerPackage();
}

export function callFromNestedModule (): string | undefined {
  return callFromNested();
}

export function callFromTopModule (): string | undefined {
  return call();
}

export function indirectlyCallFromTopModule (): string | undefined {
  return nestedCallFromTopModule();
}
