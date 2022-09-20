export const ALGOB_NAME = "algob";
export const ALGOB_CHAIN_NAME = "algobchain";

export const toCamelCase = (str: string) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}