import { getClosestCallerPackage } from "../../../../src/internal/util/caller-package";
import {
  call as callFromTop,
  callFromNestedModule as topCallFromNestedModule
} from "../top-caller-package-tester";

export function call (): string | undefined {
  return getClosestCallerPackage();
}

export function callFromNestedModule (): string | undefined {
  return call();
}

export function callFromTopModule (): string | undefined {
  return callFromTop();
}

export function indirectlyCallFromNestedpModule (): string | undefined {
  return topCallFromNestedModule();
}
