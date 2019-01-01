const bs58 = require('bs58')
const SmartBuffer = require('smart-buffer').SmartBuffer;
const ripemd160 = require('ripemd160');

const Sha256Hash = require('./Sha256Hash.js')
const ArrayCopy = require('./ArrayCopy.js')

const Sha256HashTwice = (buffer) => {
  return Sha256Hash.Sha256Hash(Sha256Hash.Sha256Hash(buffer));
}

const getSingleSignatureRedeemScript = (pubkey) => {
  // console.log('getSingleSignatureRedeemScript.pubkey', pubkey);
  const script = CreateSingleSignatureRedeemScript(pubkey);
  const scriptBuffer = Buffer.from(script);
  // console.log('getSingleSignatureRedeemScript.scriptBuffer', scriptBuffer);
  const scriptBufferHex = scriptBuffer.toString('hex').toUpperCase();
  // console.log('getSingleSignatureRedeemScript.scriptBufferHex', scriptBufferHex);
  return scriptBufferHex;
}

const CreateSingleSignatureRedeemScript = (scriptHash) => {
  
  // Extra-fast test for pay-to-script-hash CScripts:
//  return (this->size() == 23 &&
//          this->at(0) == OP_HASH160 &&
//          this->at(1) == 0x14 &&
//          this->at(22) == OP_EQUAL);
  
// https://en.bitcoin.it/wiki/Script#Standard_Transaction_to_Bitcoin_address_.28pay-to-pubkey-hash.29
//  if(     i == 0 && opcode != OP_DUP) return false;
//  else if(i == 1 && opcode != OP_HASH160) return false;
//  else if(i == 3 && opcode != OP_EQUALVERIFY) return false;
//  else if(i == 4 && opcode != OP_CHECKSIG) return false;
//  else if(i == 5) return false;
  
  // console.log('CreateSingleSignatureRedeemScript.pubkey', pubkey);
  const script = new Uint8Array(25);
  // OP_DUP
  script[0] = 0x76;
  
  // OP_HASH160
  script[1] = 0xa9;

  // push 20.
  script[2] = 0x14;

  ArrayCopy.arraycopy(scriptHash, 0, script, 3, 20);
  
//  OP_EQUALVERIFY
  script[23] = 0x88;

  // OP_CHECKSIG
  script[24] = 0xac;
  
  // console.log('CreateSingleSignatureRedeemScript.script', script);
  return script;
}

const sha256hash160 = (input) => {
// console.log('sha256hash160.input', input);
  const sha256 = Sha256Hash.Sha256Hash(input);
// console.log('sha256hash160.sha256', sha256);
  const digest = new ripemd160();
  digest.update(sha256, 0, sha256.length);
  digest.end();
  const out = digest.read();
// console.log('sha256hash160.out', out);
  return out;
}

const ToScriptHash = (publicKey) => {
  const publicKeyBuff = Buffer.from(publicKey);
  const digest = new ripemd160();
  digest.update(publicKey, 0, publicKey.length);
  digest.end();
  const out = digest.read();
  return out;
}

const ToCodeHash = (code) => {
  // console.log('ToCodeHash.code', code.toString('hex').toUpperCase());
  const f = sha256hash160(code);
//  const f = sha256hash160(code);
  const g = new Uint8Array(f.length + 1);
  g[0] = 0x58;
  // 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  // console.log('ToCodeHash.f', f.toString('hex').toUpperCase());
  ArrayCopy.arraycopy(f, 0, g, 1, f.length);
  // console.log('ToCodeHash.g', g.toString('hex').toUpperCase());
  const codeHash = Buffer.from(g);
  // console.log('ToCodeHash.codeHash', codeHash.toString('hex').toUpperCase());
  return codeHash;
}

const getProgram = (publicKey) => {
  return CreateSingleSignatureRedeemScript(sha256hash160(publicKey));
}
const getSingleSignProgramHash = (publicKey) => {
  return ToCodeHash(getProgram(publicKey));
}

const getAddressFromPublicKey = (publicKey) => {
  return getAddressFromProgramHash(getProgramHashFromPublicKey(publicKey));
}

const getProgramHashFromPublicKey = (publicKey) => {
  return getSingleSignProgramHash(Buffer.from(publicKey, 'hex'));
}

const getProgramHashFromAddress = (address) => {
// console.log('getProgramHashFromAddress.address', address);
  const programHashAndChecksum = bs58.decode(address);
// console.log('getProgramHashFromAddress.programHashAndChecksum', programHashAndChecksum);
  const programHash = programHashAndChecksum.slice(0, 21);
// console.log('getProgramHashFromAddress.programHash', programHash.toString('hex').toUpperCase());
  return programHash;
}

const getAddressFromProgramHash = (programHash) => {
// console.log('getAddressFromProgramHash.programHash', programHash.toString('hex').toUpperCase());
  const f = SmartBuffer.fromBuffer(Sha256HashTwice(programHash));
  // console.log( 'ToAddress.f', f );
  const g = new SmartBuffer();
  // console.log( 'ToAddress.g[0]', g );
  g.writeBuffer(programHash);
  // console.log( 'ToAddress.g[1]', g );
  g.writeBuffer(f.readBuffer(4));
  // console.log( 'ToAddress.g[2]', g );
  const gBuffer = g.toBuffer();
  // console.log( 'ToAddress.gBuffer', gBuffer );
  const address = bs58.encode(gBuffer);
// console.log( 'getAddressFromProgramHash.address', address );
  return address;
}

exports.getProgramHashFromPublicKey = getProgramHashFromPublicKey;
exports.getAddressFromPublicKey = getAddressFromPublicKey;
exports.getAddressFromProgramHash = getAddressFromProgramHash;
exports.getProgramHashFromAddress = getProgramHashFromAddress;
exports.getSingleSignatureRedeemScript = getSingleSignatureRedeemScript;
