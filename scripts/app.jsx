"use strict";

/** imports */
const React = require('react');
const ReactDOM = require('react-dom');

const shell = require('electron').shell;

const Row = require('react-bootstrap').Row;
const Col = require('react-bootstrap').Col;
const Grid = require('react-bootstrap').Grid;
const Table = require('react-bootstrap').Table;

const BigNumber = require('bignumber.js');

const LedgerComm = require('./LedgerComm.js');

const AddressTranscoder = require('./AddressTranscoder.js')
const KeyTranscoder = require('./KeyTranscoder.js')
const TxTranscoder = require('./TxTranscoder.js')
const TxSigner = require('./TxSigner.js')
const Asset = require('./Asset.js')
const TxFactory = require('./TxFactory.js')

/** global constants */

const LOG_LEDGER_POLLING = false;

const MAX_POLL_DATA_TYPE_IX = 2;

const PRIVATE_KEY_LENGTH = 64;

const TEST_TX_HISTORY_URL_PREFIX = 'http://45.76.238.162:3001/ext/getaddress/';

const TEST_TX_HISTORY_LINK_PREFIX = 'http://45.76.238.162:3001/tx/';

const TX_HISTORY_URL_PREFIX = TEST_TX_HISTORY_URL_PREFIX;

const TX_HISTORY_LINK_PREFIX = TEST_TX_HISTORY_LINK_PREFIX;

const MNP_HOST_PREFIX = 'http://45.76.238.162';

const MNP_REST_URL_PREFIX = `${MNP_HOST_PREFIX}:3001`;

const MNP_RPC_URL_PREFIX = `${MNP_HOST_PREFIX}:3001`;

const BALANCE_URL_PREFIX = `${MNP_REST_URL_PREFIX}/api/v1/asset/balances`;

const TX_UTXO_URL_PREFIX = `${MNP_REST_URL_PREFIX}/api/v1/asset/utxo`;

/** global variables */
var ledgerDeviceInfo = undefined;

var publicKey = undefined;

var address = undefined;

var pollDataTypeIx = 0;

var balance = undefined;

const sendToAddressStatuses = [];
sendToAddressStatuses.push('No Send-To Transaction Requested Yet');

var balanceStatus = 'No Balance Requested Yet';

var transactionHistoryStatus = 'No History Requested Yet';

const parsedTransactionHistory = [];

var unspentTransactionOutputsStatus = 'No UTXOs Requested Yet';

const parsedUnspentTransactionOutputs = [];

/** functions */
const formatDate = (date) => {
    const month = (date.getMonth() + 1).toString();
    const day = date.getDate().toString();
    const year = date.getFullYear();

    if (month.length < 2) {
        month = '0' + month
    };
    if (day.length < 2) {
        day = '0' + day
    };

    return [year, month, day].join('-');
}

const pollForDataCallback = (message) => {
  ledgerDeviceInfo = message;
  renderApp();
  pollDataTypeIx++;
  setPollForAllInfoTimer();
}

const pollForData = () => {
  if (LOG_LEDGER_POLLING) {
    console.log('getAllLedgerInfo ' + pollDataTypeIx);
  }
  var resetPollIndex = false;
  switch (pollDataTypeIx) {
    case 0:
      pollForDataCallback('Polling...');
      break;
    case 1:
      const callback = () => {
        alert(ledgerDeviceInfo);
        renderApp();
        pollForDataCallback();
      }
      LedgerComm.getLedgerDeviceInfo(pollForDataCallback);
      break;
    case MAX_POLL_DATA_TYPE_IX:
      // only check every 10 seconds for a change in device status.
      pollDataTypeIx = 0;
      setTimeout(pollForData, 10000);
      break;
    default:
      throw Error('poll data index reset failed.');
  }
};

const setPollForAllInfoTimer = () => {
  setTimeout(pollForData, 1);
}

const postJson = (url, jsonString, readyCallback, errorCallback) => {
  var xmlhttp = new XMLHttpRequest(); // new HttpRequest instance

  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4) {
      // sendToAddressStatuses.push( `XMLHttpRequest: status:${this.status} response:'${this.response}'` );
      if (this.status == 200) {
        readyCallback(JSON.parse(this.response));
      } else {
        errorCallback(this.response);
      }
    }
  }
  xhttp.responseType = 'text';
  xhttp.open('POST', url, true);
  xhttp.setRequestHeader('Content-Type', 'application/json');

  // sendToAddressStatuses.push( `XMLHttpRequest: curl ${url} -H "Content-Type: application/json" -d '${jsonString}'` );

  xhttp.send(jsonString);
}

const getJson = (url, callback) => {
  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      callback(JSON.parse(this.response));
    }
  }
  xhttp.responseType = 'text';
  xhttp.open('GET', url, true);
  xhttp.send();
}

const getBalanceCallback = (balanceResponse) => {
  balanceStatus = `Balance Received:${balanceResponse.Desc} ${balanceResponse.Error} `;
  balance = balanceResponse.Result;

  renderApp();
}

const requestUnspentTransactionOutputs = () => {
  unspentTransactionOutputsStatus = 'UTXOs Requested';
  const unspentTransactionOutputsUrl = `${TX_UTXO_URL_PREFIX}/${address}/${Asset.elaAssetId}`;

  // console.log( 'unspentTransactionOutputsUrl ' + unspentTransactionOutputsUrl );

  getJson(unspentTransactionOutputsUrl, getUnspentTransactionOutputsCallback);
};

const getUnspentTransactionOutputsCallback = (response) => {
  unspentTransactionOutputsStatus = 'UTXOs Received';
  parsedUnspentTransactionOutputs.length = 0;

  console.log('getUnspentTransactionOutputsCallback ' + JSON.stringify(response));

  response.Result.forEach((utxo, utxoIx) => {
    const valueBigNumber = BigNumber(utxo.Value, 10);

    utxo.utxoIx = utxoIx;
    utxo.valueSats = valueBigNumber.times(Asset.satoshis);

    parsedUnspentTransactionOutputs.push(utxo);
  });

  renderApp();
}

const getTransactionHistoryCallback = (transactionHistory) => {
  transactionHistoryStatus = 'History Received';
  parsedTransactionHistory.length = 0;
  transactionHistory.txs.forEach((tx, txIx) => {
    const time = formatDate(new Date(tx.time*1000));
    tx.vin.forEach((vinElt) => {
      const parsedTransaction = {};
      parsedTransaction.n = txIx;
      parsedTransaction.type = 'input';
      parsedTransaction.value = vinElt.value;
      parsedTransaction.valueSat = vinElt.valueSat;
      parsedTransaction.address = vinElt.addr;
      parsedTransaction.txHash = tx.txid;
      parsedTransaction.txDetailsUrl = TX_HISTORY_LINK_PREFIX + tx.txid;
      parsedTransaction.time = time;
      parsedTransactionHistory.push(parsedTransaction);
    });
    tx.vout.forEach((voutElt) => {
      voutElt.scriptPubKey.addresses.forEach((voutAddress) => {
        const parsedTransaction = {};
        parsedTransaction.n = txIx;
        parsedTransaction.type = 'output';
        parsedTransaction.value = voutElt.value;
        parsedTransaction.valueSat = voutElt.valueSat;
        parsedTransaction.address = voutAddress;
        parsedTransaction.txHash = tx.txid;
        parsedTransaction.txDetailsUrl = TX_HISTORY_LINK_PREFIX + tx.txid;
        parsedTransaction.time = time;
        parsedTransactionHistory.push(parsedTransaction);
      });
    });
  });

  renderApp();
}

const get = (id) => {
  const elt = document.getElementById(id);
  if (elt == null) {
    throw new Error('elt is null:' + id);
  }
  return elt;
}

const hide = (id) => {
  get(id).style = 'display:none;';
}

const show = (id) => {
  get(id).style = 'display:default;';
}

const getPublicKeyFromLedger = () => {
    alert('not implemented yet');
}

const getPublicKeyFromPrivateKey = () => {
  show('privateKey');
  const privateKeyElt = document.getElementById('privateKey');
  const privateKey = privateKeyElt.value;
  if (privateKey.length != PRIVATE_KEY_LENGTH) {
    alert(`private key must be a hex encoded string of length ${PRIVATE_KEY_LENGTH}, not ${privateKey.length}`);
    return;
  }
  publicKey = KeyTranscoder.getPublic(privateKey);
  address = AddressTranscoder.getAddressFromPublicKey(publicKey);
  requestTransactionHistory();
  requestBalance();
  requestUnspentTransactionOutputs();
  showHome();
}

const sendAmountToAddressErrorCallback = (error) => {
  sendToAddressStatuses.push(JSON.stringify(error));
  renderApp();
}

const sendAmountToAddressReadyCallback = (transactionJson) => {
  sendToAddressStatuses.push(JSON.stringify(transactionJson));
  renderApp();
}

const sendAmountToAddress = () => {
  const sendToAddressElt = document.getElementById('sendToAddress');
  const sendAmountElt = document.getElementById('sendAmount');
  const privateKeyElt = document.getElementById('privateKey');

  const sendToAddress = sendToAddressElt.value;
  const sendAmount = sendAmountElt.value;
  const privateKey = privateKeyElt.value;

  const unspentTransactionOutputs = parsedUnspentTransactionOutputs;
  console.log('sendAmountToAddress.unspentTransactionOutputs ' + JSON.stringify(unspentTransactionOutputs));

  const encodedTx = TxFactory.createSendToTx(privateKey, unspentTransactionOutputs, sendToAddress, sendAmount);

  if (encodedTx == undefined) {
    return;
  }

  const txUrl = `${MNP_RPC_URL_PREFIX}`;

  const jsonString = `{"method":"sendrawtransaction", "params": ["${encodedTx}"]}`;

  console.log('sendAmountToAddress.encodedTx ' + JSON.stringify(encodedTx));

  const decodedTx = TxTranscoder.decodeTx(Buffer.from(encodedTx, 'hex'));

  console.log('sendAmountToAddress.decodedTx ' + JSON.stringify(decodedTx));

  sendToAddressStatuses.length = 0;
  sendToAddressStatuses.push(JSON.stringify(encodedTx));
  sendToAddressStatuses.push(JSON.stringify(decodedTx));
  sendToAddressStatuses.push(`Transaction Requested: curl ${txUrl} -H "Content-Type: application/json" -d '${jsonString}'`);
  renderApp();
  postJson(MNP_RPC_URL_PREFIX, jsonString, sendAmountToAddressReadyCallback, sendAmountToAddressErrorCallback);
}

const requestTransactionHistory = () => {
  transactionHistoryStatus = 'History Requested';
  const transactionHistoryUrl = TX_HISTORY_URL_PREFIX + address;
  getJson(transactionHistoryUrl, getTransactionHistoryCallback);
};

const requestBalance = () => {
  balanceStatus = 'Balance Requested';
  const balanceUrl = `${BALANCE_URL_PREFIX}/${address}`;
  getJson(balanceUrl, getBalanceCallback);
};

const removeClass = (id, cl) => {
  get(id).classList.remove(cl);
}

const addClass = (id, cl) => {
  get(id).classList.add(cl);
}

const selectButton = (id) => {
  addClass(id, 'white_on_light_purple');
  removeClass(id, 'white_on_purple_with_hover');
}

const clearButtonSelection = (id) => {
  removeClass(id, 'white_on_light_purple');
  addClass(id, 'white_on_purple_with_hover');
}

const hideEverything = () => {
  clearButtonSelection('send');
  clearButtonSelection('home');
  clearButtonSelection('receive');
  clearButtonSelection('transactions');
  hide('private-key-entry');
  hide('cancel-confirm-transaction');
  hide('fees');
  hide('confirm-and-see-fees');
  hide('to-address');
  hide('send-amount');
  hide('from-address');
  hide('balance');
  hide('transaction-more-info');
  hide('transaction-list-small');
  hide('transaction-list-large');
  hide('your-address');
  hide('private-key-login');
//  hide('ledger-login');
  hide('mnpcoin-branding');
  hide('send-spacer-01');
}

const showLogin = () => {
  clearGlobalData();
  hideEverything();
  show('private-key-login');
//  show('ledger-login');
  show('mnpcoin-branding');
}

const showHome = () => {
  hideEverything();
  show('transaction-more-info');
  show('transaction-list-small');
  show('your-address');
  show('mnpcoin-branding');
  selectButton('home');
}

const showSend = () => {
  hideEverything();
  show('from-address');
  show('balance');
  show('send-amount');
  show('to-address');
  show('confirm-and-see-fees');
  show('send-spacer-01');
  selectButton('send');
}

const showReceive = () => {
  hideEverything();
  show('your-address');
  selectButton('receive');
}

const showTransactions = () => {
  hideEverything();
  show('transaction-more-info');
  show('transaction-list-large');
  selectButton('transactions');
}

const showPrivateKeyEntry = () => {
    hideEverything();
    show('private-key-entry');
}

const clearGlobalData = () => {
    get('privateKey').value = '';
    publicKey = undefined;
    address = undefined;
    balance = undefined;

    sendToAddressStatuses.length = 0;
    sendToAddressStatuses.push('No Send-To Transaction Requested Yet');

    balanceStatus = 'No Balance Requested Yet';

    transactionHistoryStatus = 'No History Requested Yet';
    parsedTransactionHistory.length = 0;
    
    unspentTransactionOutputsStatus = 'No UTXOs Requested Yet';
    parsedUnspentTransactionOutputs.length = 0;
    renderApp();
}

const UseLedgerButton = () => {
    if(ledgerDeviceInfo?ledgerDeviceInfo.enabled:false) {
        return  (
                <div class="white_on_red bordered display_inline_block float_right fake_button rounded padding_5px"
                    onClick={(e) => getPublicKeyFromLedger()}>Use Ledger</div>
        );
    } else {
        return  (
                <div class="white_on_pink bordered display_inline_block float_right fake_button rounded padding_5px">Use Ledger</div>
        );
    }
    return ( <div/> );
}

const TransactionHistoryElementIcon = (props) => {
    const item = props.item;
    if(item.type == 'input') {
        return (<img src="artwork/received-ela.svg"/>);
    }
    if(item.type == 'output') {
        return (<img src="artwork/sent-ela.svg"/>);
    }
    return ( <div/> );
}


const onLinkClick = (event) => {
  event.preventDefault();
  shell.openExternal(event.currentTarget.href);
}

class App extends React.Component {
  render() {
    return (<div>
      <table class="w800h600px no_padding no_border">
        <tr class="no_padding">
          <td class="valign_top white_on_purple no_border" style={{
              width: '150px'
            }}>
            <table class="w100pct no_border">
              <tr>
                <td class="black_on_offwhite h20px no_border user_select_none">
                  <img class="valign_middle" src="artwork/mnpcoin-black-small.svg"></img>
                  MNPCoin</td>
              </tr>
              <tr>
                <td class="white_on_purple h20px no_border"></td>
              </tr>
              <tr>
                <td id='home' class="white_on_purple_with_hover h20px fake_button" onClick={(e) => showHome()}>
                  <img class="valign_middle" src="artwork/home.svg"></img>
                  Home</td>
              </tr>
              <tr>
                <td id='send' class="white_on_purple_with_hover h20px fake_button" onClick={(e) => showSend()}>
                  <img class="valign_middle" src="artwork/send.svg"></img>
                  Send</td>
              </tr>
              <tr>
                <td id='receive' class="white_on_purple_with_hover h20px fake_button" onClick={(e) => showReceive()}>
                  <img class="valign_middle" src="artwork/receive.svg"></img>
                  Receive</td>
              </tr>
              <tr>
                <td id='transactions' class="white_on_purple_with_hover h20px fake_button" onClick={(e) => showTransactions()}>
                  <img class="valign_middle" src="artwork/transactions.svg"></img>
                  Transactions</td>
              </tr>
              <tr>
                <td class="white_on_purple h290px no_border"></td>
              </tr>
              <tr>
                <td class="white_on_purple_with_hover h20px fake_button" onClick={(e) => showLogin()}>Logout</td>
              </tr>
            </table>
          </td>
          <td class="valign_top black_on_offwhite no_border no_padding">
            <table class="w626px black_on_offwhite no_border no_padding">
              <tr id="mnpcoin-branding" class="no_border no_padding">
                <td class="h325px w595px no_border no_padding">
                  <div class="branding_container">
                    <a href="https://mnpcoin.org" onClick={(e) => onLinkClick(e)}>
                        <img class="branding_image" style={{
                            left: '175px',
                            top: '10px'
                          }} src="artwork/mnpcoin-branding.svg"></img>
                        <img style={{
                            left: '380px',
                            top: '130px'
                          }} class="branding_image" src="artwork/mnpcoin-white-large.svg"></img>
                    </a>
                  </div>
                </td>
              </tr>
              <tr id="private-key-login">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">Private Key</div>
                  <p>Enter private key.</p>
                  <p>
                    <div class="white_on_gray bordered display_inline_block float_right fake_button rounded padding_5px" 
                         onClick={(e) => showPrivateKeyEntry()}>Enter Key</div>
                  </p>
                </td>
              </tr>
             <tr id="private-key-entry">
                 <td class="black_on_white h20px darkgray_border">
                   <div class="gray_on_white">Private Key</div>
                   <br/>
                   <input style={{fontFamily: 'monospace'}} type="text" size="64" id="privateKey" placeholder="Private Key"></input>
                   <br/>
                   <div class="white_on_gray bordered display_inline_block float_right fake_button rounded padding_5px" 
                   onClick={(e) => getPublicKeyFromPrivateKey()}>Use Private Key</div>
                 </td>
               </tr>
              <tr id="your-address">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">Your Address</div>
                  <br/>{address}
                </td>
              </tr>
              <tr id="transaction-list-small">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white ` display_inline_block">Previous Transactions (2 total)</div>
                  <div class="gray_on_white float_right display_inline_block">1234 Blocks</div>
                  <br/>
                  <table class="w100pct black_on_offwhite no_border whitespace_nowrap">
                    {
                      parsedTransactionHistory.map((item, index) => {
                        if(index > 2) {
                            return '';
                        }
                        return (<tr>
                          <td class="no_border no_padding">{item.n}</td>
                          <td class="no_border no_padding">
                            <TransactionHistoryElementIcon item={item}/>{/*item.type*/}
                          </td>
                          <td class="no_border no_padding">{item.value} ELA</td>
                          <td class="no_border no_padding">
                          <a href={item.txDetailsUrl} onClick={(e) => onLinkClick(e)}>{item.txHash}</a>
                          </td>
                          <td class="no_border no_padding">
                            {item.time}
                          </td>
                        </tr>)
                      })
                    }
                  </table>
                </td>
              </tr>
              <tr id="transaction-list-large">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white ` display_inline_block">Previous Transactions (22 total)</div>
                  <div class="gray_on_white float_right display_inline_block">1234 Blocks</div>
                  <p>
                    <div class="h470px overflow_auto">
                      <table class="w100pct black_on_offwhite no_border whitespace_nowrap">
                      {
                        parsedTransactionHistory.map((item, index) => {
                          return (<tr>
                            <td class="no_border no_padding">{item.n}</td>
                            <td class="no_border no_padding">
                              <TransactionHistoryElementIcon item={item}/>{/*item.type*/}
                            </td>
                            <td class="no_border no_padding">{item.value} ELA</td>
                            <td class="no_border no_padding">
                            <a href={item.txDetailsUrl} onClick={(e) => onLinkClick(e)}>{item.txHash}</a>
                            </td>
                            <td class="no_border no_padding">
                              {item.time}
                            </td>
                          </tr>)
                        })
                      }
                    </table>
                    </div>
                  </p>
                </td>
              </tr>
              <tr id="transaction-more-info">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">More Info
                  <br/>Tap on the transaction ID to view further details or visit http://45.76.238.162:3001/
                  <br/>Or http://45.76.238.162:3001/
                  </div>
                </td>
              </tr>
              <tr id="from-address">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">From Address</div>
                  <p>{address}</p>
                </td>
              </tr>
              <tr id="balance">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">Balance</div>
                  <p>{balance}</p>
                </td>
              </tr>
              <tr id="send-amount">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">Send Amount</div>
                  <br/>
                  <input style={{fontFamily: 'monospace'}} type="text" size="64" id="sendAmount" placeholder="Send Amount"></input>
                </td>
              </tr>
              <tr id="to-address">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">To Address</div>
                  <br/>
                  <input style={{fontFamily: 'monospace'}} type="text" size="64" id="sendToAddress" placeholder="Send To Address"></input>
                </td>
              </tr>
              <tr id="send-spacer-01">
                <td class="black_on_white h200px no_border">
                  <div class="gray_on_white">Balance Status</div>
                  <br/>
                  {balanceStatus}
                  <br/>
                  <div class="gray_on_white">Send Status</div>
                  <br/>
                  <table>
                  {
                    sendToAddressStatuses.map((sendToAddressStatus, index) => {
                      return (<tr>
                        <td>{sendToAddressStatus}</td>
                      </tr>)
                    })
                  }
                </table>
                </td>
              </tr>
              <tr id="confirm-and-see-fees">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">Confirm</div>
                  <p>Tap ‘Next’ to confirm the fees for your transaction.</p>
                  <p>
                    <div class="lightgray_border white_on_black bordered display_inline_block float_right fake_button rounded padding_5px"
                      onClick={(e) => sendAmountToAddress()}>Next</div>
                  </p>
                </td>
              </tr>
              <tr id="fees">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white display_inline_block">Fees</div>
                  <div class="black_on_white float_right display_inline_block">Estimated New Balance</div>
                </td>
              </tr>
              <tr id="cancel-confirm-transaction">
                <td class="black_on_white h20px darkgray_border">
                  <div class="gray_on_white">Confirm</div>
                  <p>Your balance will be deducted 10.5 ELA + 0.000045 ELA in fees.</p>
                  <p>
                    <div class="white_on_black lightgray_border bordered display_inline_block float_right fake_button rounded padding_5px">Confirm</div>
                    <div class="white_on_gray darkgray_border bordered display_inline_block float_right fake_button rounded padding_5px">Cancel</div>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>)
  }
}
const renderApp = () => {
  ReactDOM.render(<App/>, document.getElementById('main'));
};
const onLoad = () => {
  showLogin();
}

/** call initialization functions */
window.onload = onLoad;

setPollForAllInfoTimer();

renderApp();
