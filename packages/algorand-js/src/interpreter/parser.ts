import { ERRORS } from "../errors/errors-list";
import { Operator } from "../types";

/**
 * Description: Read line and split it into fields
 * - ignore comments, keep only part that is relevant to interpreter
 * @param line : Line read from TEAL file
 */
/* eslint-disable sonarjs/cognitive-complexity */
export function fieldsFromLine (line: string): string[] {
  // Trim whitespace from both sides of a string
  line = line.trim();
  const fields = [] as string[];
  let i = 0;
  let start = i;
  let inString = false;
  let inBase64 = false;
  while (i < line.length) {
    // check if not space
    if (line[i] !== ' ') {
      switch (line[i]) {
        // check for string literal
        case '"':
          if (!inString) {
            if ((i === 0) || (i > 0 && line[i - 1] === ' ')) {
              inString = true;
            }
          } else {
            // if not escape symbol
            if (line[i - 1] !== '\\') {
              inString = false;
            }
          }
          break;
        // is a comment?
        case '/':
          if (i < line.length - 1 && line[i + 1] === '/' && !inBase64 && !inString) {
            // if a comment without whitespace
            if (start !== i) {
              fields.push(line.substr(start, i - start));
            }
            return fields;
          }
          break;
        // is base64( seq?
        case '(':
          var prefix = line.substr(start, i - start);
          if (prefix === "base64" || prefix === "b64") {
            inBase64 = true;
          }
          break;
        // is ) as base64( completion
        case ')':
          if (inBase64) {
            inBase64 = false;
          }
          break;
        default:
          break;
      }
      i++;
      continue;
    }
    if (!inString) {
      const value = line.substr(start, i - start);
      fields.push(value);
      if (value === "base64" || value === "b64") {
        inBase64 = true;
      } else if (inBase64) {
        inBase64 = false;
      }
    }
    i++;

    if (!inString) {
      while (i < line.length && line[i] === ' ') {
        i++;
      }
      start = i;
    }
  }

  // add rest of the string if any
  if (start < line.length) {
    fields.push(line.substr(start, i - start));
  }

  return fields;
  // int byte addr + - * /
  // make objects and leave Ex: new Addr("AHGDKKADGKAJD") , new Add()
}

/* export function opcodesFromFields (fields: string[]): Operator[] {

} */
