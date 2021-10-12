// Copyright 2021 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0
import { Curl } from "@iota/crypto.js";
const PRIVATE_KEY_NUM_FRAGMENTS = 27;
// @internal
export const PRIVATE_KEY_FRAGMENT_LENGTH = PRIVATE_KEY_NUM_FRAGMENTS * Curl.HASH_LENGTH;
const MIN_TRYTE_VALUE = -13;
const MAX_TRYTE_VALUE = 13;
const MIN_TRIT_VALUE = -1;
const MAX_TRIT_VALUE = 1;
/**
 * Calculate the subseed for the seed.
 * @param seed The seed trits.
 * @param index The index for the subseed.
 * @returns The subseed trits.
 * @internal
 */
export function subseed(seed, index) {
    const sponge = new Curl(27);
    const subseedPreimage = seed.slice();
    let localIndex = index;
    while (localIndex-- > 0) {
        for (let i = 0; i < subseedPreimage.length; i++) {
            if (subseedPreimage[i]++ >= MAX_TRIT_VALUE) {
                subseedPreimage[i] = MIN_TRIT_VALUE;
            }
            else {
                break;
            }
        }
    }
    sponge.absorb(subseedPreimage, 0, subseedPreimage.length);
    const ss = new Int8Array(Curl.HASH_LENGTH);
    sponge.squeeze(ss, 0, ss.length);
    return ss;
}
/**
 * Get the digest from the subseed.
 * @param subSeed The subseed to get the digest for.
 * @param securityLevel The security level to get the digest.
 * @returns The digest trits.
 * @internal
 */
export function digestFromSubseed(subSeed, securityLevel) {
    const curl1 = new Curl(27);
    const curl2 = new Curl(27);
    const curl3 = new Curl(27);
    const length = securityLevel * PRIVATE_KEY_FRAGMENT_LENGTH / Curl.HASH_LENGTH;
    const digest = new Int8Array(Curl.HASH_LENGTH);
    curl1.absorb(subSeed, 0, subSeed.length);
    for (let i = 0; i < length; i++) {
        curl1.squeeze(digest, 0, digest.length);
        for (let k = 0; k < MAX_TRYTE_VALUE - MIN_TRYTE_VALUE + 1; k++) {
            curl2.reset();
            curl2.absorb(digest, 0, digest.length);
            curl2.squeeze(digest, 0, digest.length);
        }
        curl3.absorb(digest, 0, digest.length);
    }
    curl3.squeeze(digest, 0, digest.length);
    return digest;
}
/**
 * Get the address from the digests.
 * @param digests The digests to get the address for.
 * @returns The address trits.
 * @internal
 */
export function address(digests) {
    const sponge = new Curl(27);
    sponge.absorb(digests, 0, digests.length);
    const addressTrits = new Int8Array(Curl.HASH_LENGTH);
    sponge.squeeze(addressTrits, 0, addressTrits.length);
    return addressTrits;
}
/**
 * Get the private key from the subseed.
 * @param subSeed The subseed to get the private key for.
 * @param securityLevel The security level for the private key.
 * @returns The private key trits.
 * @internal
 */
export function privateKeyFromSubseed(subSeed, securityLevel) {
    const keyLength = securityLevel * PRIVATE_KEY_FRAGMENT_LENGTH;
    const keyTrits = new Int8Array(keyLength);
    const actualKeyTrits = new Int8Array(keyLength);
    const sponge = new Curl(27);
    sponge.absorb(subSeed, 0, subSeed.length);
    sponge.squeeze(keyTrits, 0, keyTrits.length);
    for (let i = 0; i < keyLength / Curl.HASH_LENGTH; i++) {
        const offset = i * Curl.HASH_LENGTH;
        sponge.reset();
        sponge.absorb(keyTrits, offset, Curl.HASH_LENGTH);
        actualKeyTrits.set(sponge.rate(), offset);
    }
    return actualKeyTrits;
}
/**
 * Create a signature for the trits.
 * @param hashTrits The trits to create the signature for.
 * @param key The key to use for signing.
 * @returns The signature trits.
 * @internal
 */
export function signature(hashTrits, key) {
    const signatures = new Int8Array(key.length);
    const sponge = new Curl(27);
    for (let i = 0; i < key.length / Curl.HASH_LENGTH; i++) {
        let buffer = key.subarray(i * Curl.HASH_LENGTH, (i + 1) * Curl.HASH_LENGTH);
        for (let k = 0; k < MAX_TRYTE_VALUE - (hashTrits[i * 3] + (hashTrits[(i * 3) + 1] * 3) + (hashTrits[(i * 3) + 2] * 9)); k++) {
            sponge.reset();
            sponge.absorb(buffer, 0, buffer.length);
            buffer = sponge.rate();
        }
        signatures.set(buffer, i * Curl.HASH_LENGTH);
    }
    return signatures;
}
/**
 * Check the security level.
 * @param hash The hash to check.
 * @returns The security level
 * @internal
 */
export function checksumSecurity(hash) {
    const dataSum1 = hash.slice(0, Curl.HASH_LENGTH / 3);
    let sum1 = 0;
    for (let i = 0; i < dataSum1.length; i++) {
        sum1 += dataSum1[i];
    }
    if (sum1 === 0) {
        return 1;
    }
    const dataSum2 = hash.slice(0, 2 * Curl.HASH_LENGTH / 3);
    let sum2 = 0;
    for (let i = 0; i < dataSum2.length; i++) {
        sum2 += dataSum2[i];
    }
    if (sum2 === 0) {
        return 2;
    }
    let sum3 = 0;
    for (let i = 0; i < hash.length; i++) {
        sum3 += hash[i];
    }
    return sum3 === 0 ? 3 : 0;
}
/**
 * Get the digest from the signature
 * @param hash The hash to get the digest.
 * @param sig The signature.
 * @returns The digest.
 * @internal
 */
export function digestFromSignature(hash, sig) {
    const sponge = new Curl(27);
    const bytes = new Int8Array(sig.length);
    for (let i = 0; i < (sig.length / Curl.HASH_LENGTH); i++) {
        let innerBytes = sig.slice(i * Curl.HASH_LENGTH, (i + 1) * Curl.HASH_LENGTH);
        for (let j = 0; j < (hash[i * 3] + (hash[(i * 3) + 1] * 3) + (hash[(i * 3) + 2] * 9)) - MIN_TRYTE_VALUE; j++) {
            sponge.reset();
            sponge.absorb(innerBytes, 0, innerBytes.length);
            innerBytes = sponge.rate();
        }
        bytes.set(innerBytes, i * Curl.HASH_LENGTH);
    }
    sponge.reset();
    sponge.absorb(bytes, 0, bytes.length);
    return sponge.rate();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXNzLXAyNy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zaWduaW5nL2lzcy1wMjcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsK0JBQStCO0FBQy9CLHNDQUFzQztBQUN0QyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFdkMsTUFBTSx5QkFBeUIsR0FBVyxFQUFFLENBQUM7QUFDN0MsWUFBWTtBQUNaLE1BQU0sQ0FBQyxNQUFNLDJCQUEyQixHQUFXLHlCQUF5QixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7QUFDaEcsTUFBTSxlQUFlLEdBQVcsQ0FBQyxFQUFFLENBQUM7QUFDcEMsTUFBTSxlQUFlLEdBQVcsRUFBRSxDQUFDO0FBQ25DLE1BQU0sY0FBYyxHQUFXLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLE1BQU0sY0FBYyxHQUFXLENBQUMsQ0FBQztBQUVqQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsT0FBTyxDQUFDLElBQWUsRUFBRSxLQUFhO0lBQ2xELE1BQU0sTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRTVCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNyQyxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFFdkIsT0FBTyxVQUFVLEVBQUUsR0FBRyxDQUFDLEVBQUU7UUFDckIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDN0MsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxjQUFjLEVBQUU7Z0JBQ3hDLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUM7YUFDdkM7aUJBQU07Z0JBQ0gsTUFBTTthQUNUO1NBQ0o7S0FDSjtJQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFFLENBQUMsRUFB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