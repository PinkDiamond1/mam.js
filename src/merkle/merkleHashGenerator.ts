import { address, digestFromSubseed, privateKeyFromSubseed, subseed } from "../signing/iss-p27";

/**
 * Generate an address for the merklr tree.
 * @param seedTrits The trits for the seed.
 * @param index The index of the address to generate.
 * @param security The security level of the address to generate.
 * @returns The address and the private key.
 */
export function generateAddress(seedTrits: Int8Array, index: number, security: number): {
    /**
     * The address generated.
     */
    address: Int8Array;
    /**
     * The private key generated with the address.
     */
    privateKey: Int8Array
} {
    const ss = subseed(seedTrits, index);
    const dg = digestFromSubseed(ss, security);

    return {
        address: address(dg),
        privateKey: privateKeyFromSubseed(ss, security)
    };
}
