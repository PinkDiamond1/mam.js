// Copyright 2021 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0
import { Curl } from "@iota/crypto.js";
import { TrytesHelper } from "../utils/trytesHelper.mjs";
import { generateAddress } from "./merkleHashGenerator.mjs";
import { MerkleNode } from "./merkleNode.mjs";
/**
 * Class to represent a merkle tree.
 * @internal
 */
export class MerkleTree {
    /**
     * Create a new instance of the merkle tree.
     * @param seed The seed to use for the tree.
     * @param index The start index for the creation.
     * @param count The count for the creation.
     * @param security The security level to create the hashes.
     */
    constructor(seed, index, count, security) {
        const seedTrits = TrytesHelper.toTrits(seed);
        const leaves = [];
        for (let i = 0; i < count; i++) {
            const addressPrivateKey = generateAddress(seedTrits, index + i, security);
            leaves.push(new MerkleNode(undefined, undefined, addressPrivateKey.address, addressPrivateKey.privateKey));
            leaves[i].size = 1;
        }
        this.root = this.buildTree(leaves);
    }
    /**
     * Recalculate the root for the siblings.
     * @param rate The current address.
     * @param siblings The siblings data.
     * @param index The index in the tree.
     * @returns The new sibling root.
     */
    static root(rate, siblings, index) {
        const sponge = new Curl(27);
        let i = 1;
        const numChunks = Math.ceil(siblings.length / Curl.HASH_LENGTH);
        for (let c = 0; c < numChunks; c++) {
            const chunk = siblings.slice(c * Curl.HASH_LENGTH, (c + 1) * Curl.HASH_LENGTH);
            sponge.reset();
            // eslint-disable-next-line no-bitwise
            if ((i & index) === 0) {
                sponge.absorb(rate, 0, rate.length);
                sponge.absorb(chunk, 0, chunk.length);
            }
            else {
                sponge.absorb(chunk, 0, chunk.length);
                sponge.absorb(rate, 0, rate.length);
            }
            // eslint-disable-next-line no-bitwise
            i <<= 1;
            rate = sponge.rate();
        }
        return sponge.rate();
    }
    /**
     * Get a sub tree.
     * @param index The index of the subtree.
     * @returns The key and leaves for the sub tree.
     */
    getSubtree(index) {
        var _a;
        if (this.root.size === 1) {
            return {
                key: ((_a = this.root.left) === null || _a === void 0 ? void 0 : _a.privateKeyTrits)
                    ? this.root.left.privateKeyTrits : new Int8Array(), leaves: []
            };
        }
        const leaves = [];
        let node = this.root;
        let size = this.root.size;
        let privateKey;
        if (index < size) {
            while (node) {
                if (!node.left) {
                    privateKey = node.privateKeyTrits;
                    break;
                }
                size = node.left.size;
                if (index < size) {
                    leaves.push(node.right ? node.right : node.left);
                    node = node.left;
                }
                else {
                    leaves.push(node.left);
                    node = node.right;
                    index -= size;
                }
            }
        }
        leaves.reverse();
        return {
            key: privateKey !== null && privateKey !== void 0 ? privateKey : new Int8Array(),
            leaves
        };
    }
    /**
     * Build tree from the leaf hashes.
     * @param leaves The leaves to build the tree from.
     * @returns The root node.
     */
    buildTree(leaves) {
        const subnodes = [];
        for (let i = 0; i < leaves.length; i += 2) {
            const left = leaves[i];
            const right = (i + 1 < leaves.length) ? leaves[i + 1] : undefined;
            let addressTrits;
            if (right) {
                const sponge = new Curl(27);
                sponge.absorb(left.addressTrits, 0, left.addressTrits.length);
                sponge.absorb(right.addressTrits, 0, right.addressTrits.length);
                addressTrits = new Int8Array(Curl.HASH_LENGTH);
                sponge.squeeze(addressTrits, 0, addressTrits.length);
            }
            else {
                addressTrits = left.addressTrits;
            }
            subnodes.push(new MerkleNode(left, right, addressTrits, undefined));
        }
        if (subnodes.length === 1) {
            return subnodes[0];
        }
        return this.buildTree(subnodes);
    }
}
