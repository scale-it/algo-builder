// https://docs.microsoft.com/en-us/dotnet/api/system.uint64.maxvalue?view=net-5.0
export const MAX_UINT64 = BigInt("18446744073709551615");
export const MIN_UINT64 = BigInt("0");
export const MAX_UINT8 = 255;
export const MIN_UINT8 = 0;
export const DEFAULT_STACK_ELEM = BigInt("0");
export const MAX_CONCAT_SIZE = 4096;

export const reDigit = /^\d+$/;

/** is Base64 regex
 * * ^                          # Start of input
 * ([0-9a-zA-Z+/]{4})*        # Groups of 4 valid characters decode
 *                            # to 24 bits of data for each group
 * (                          # Either ending with:
 *     ([0-9a-zA-Z+/]{2}==)   # two valid characters followed by ==
 *     |                      # , or
 *     ([0-9a-zA-Z+/]{3}=)    # three valid characters followed by =
 * )?                         # , or nothing
 * $                          # End of input
 */
export const reBase64 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
