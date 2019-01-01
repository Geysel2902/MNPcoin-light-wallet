const assert = require('chai').assert;
const KeyTranscoder = require('../scripts/KeyTranscoder.js')
const AddressTranscoder = require('../scripts/AddressTranscoder.js')

const wif = require('wif')
const fixtures = require('./keyDerivationTestData.json')

const privateWif = fixtures.privateWif;
const hexPrivateKey = fixtures.privateKey;
const expectedPublicKey = fixtures.publicKey;
const expectedAddress = fixtures.address;
const hexScriptHash = fixtures.scriptHash;


/**
 * mnpcoin-cli dumpprivkey cdpaajkxFQBTjpmz15Wot23JiAwxemfJAX KudxEakxJBqreFrShunUtk6LxLo2R899X8wuP81j82bF1zAvVVKC 
 * <p>
 * importprivkey
 */

describe('key-derivation', function() {
  it('private WIF derives expected private', function() {
    const privateKey = wif.decode(privateWif).privateKey.toString('hex');
    assert.equal(privateKey, hexPrivateKey, 'PrivateKey must match expected');
  });
  it('private WIF derives expected public', function() {
    const privateKey = wif.decode(privateWif).privateKey.toString('hex');
    const actualPublicKey = KeyTranscoder.getPublic(privateKey);
    assert.equal(actualPublicKey, expectedPublicKey, 'PublicKey must match expected');
  });
  it('private ECDSA derives expected public', function() {
    const actualPublicKey = KeyTranscoder.getPublic(hexPrivateKey);
    assert.equal(actualPublicKey, expectedPublicKey, 'PublicKey must match expected');
  });
  it('public ECDSA derives expected address', function() {
    const actualAddress = AddressTranscoder.getAddressFromPublicKey(expectedPublicKey);
    assert.equal(actualAddress, expectedAddress, 'Address must match expected');
  });
  it('scripthash derives expected address', function() {
    const rawScriptHash = Buffer.from(hexScriptHash, 'hex')
    const actualAddress = AddressTranscoder.getAddressFromProgramHash(rawScriptHash);
    assert.equal(actualAddress, expectedAddress, 'Address must match expected');
  });
  it('address derives expected scripthash', function() {
    const expectedScriptHash = hexScriptHash;
    const actualScriptHash = AddressTranscoder.getProgramHashFromAddress(expectedAddress).toString('hex');
    assert.equal(actualScriptHash, expectedScriptHash, 'ScriptHash must match expected');
  });
  it('public ECDSA derives expected scripthash', function() {
    const expectedScriptHash = hexScriptHash;
    const actualScriptHash = AddressTranscoder.getProgramHashFromPublicKey(expectedPublicKey).toString('hex');
    assert.equal(actualScriptHash, expectedScriptHash, 'ScriptHash must match expected');
  });
});
