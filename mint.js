import { abi, address } from './contract.js';
import { web3, connectMetaMask } from './connectWallet.js';

export let contract = new web3.eth.Contract(abi, address);

var tokenID;
var isLoading = false;
var isPaused = false;

function randomInt() {
  let min = 1;
  let max = 5;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formattedResult(result) {
  return `<h2>${result.name}</h2><br/><p>${result.description}</p>`
}

async function generate() {
  // document.querySelector('#generate-done').style = "display:none";

  let accounts = await web3.eth.getAccounts();
  let tokenID = randomInt();
  let wallet = ethereum.selectedAddress || accounts[0];
  let url = `https://tigerfightclub.vercel.app/api/token/${tokenID}`
  let result = await (await fetch(url)).json();

  document.querySelector('#generate').style = "display:block";
  document.querySelector('#generate-info').innerHTML = formattedResult(result);
  document.querySelector('#generate-image').src = `https://cloudflare-ipfs.com/ipfs/${result.image.split("//")[1]}`;

  // document.querySelector('#generate-in-progress').style = "display:none";
  // document.querySelector('#generate-done').style = "display:block";
}

async function claim() {
  try {
    await connectMetaMask();
  } catch (error) {
    alert("Connect Metamask wallet to continue");
  }

  // Loading
  if (isLoading) {
    return false;
  }

  // Paused
  if (isPaused) {
    return false;
  }

  // Wallet
  let accounts = await web3.eth.getAccounts();
  let wallet = ethereum.selectedAddress || accounts[0];

  // Network
  let network = await web3.eth.net.getId()
  if (network != 1) {
    alert("Hey! CryptoWords are only supported on the Ethereum network. It looks like you’re connected to a different network. Please check your settings and try again.");
    return;
  }

  document.querySelector('#loading-text').innerHTML = "TRANSACTING WITH CRYPTOWORDS CONTRACT...";
  document.querySelector('#loading-modal').style = "display:flex";
  isLoading = true;

  // Listener
  var transferBlockHash = "";
  var chainlinkRequestId = "";

  contract.events.allEvents({}, function(error, event) {
    let eventName = event.event;

    // Gate block hash on transfer matching sender address.
    if (eventName == "Transfer" && event.returnValues.to.toLowerCase() == wallet.toLowerCase()) {
      transferBlockHash = event.blockHash;
      document.querySelector('#loading-text').innerHTML = `GENERATING WORD #${tokenID}...`;
    }

    // Gate Chainlink id on block hash matching Transfer.
    if (eventName == "ChainlinkRequested" && transferBlockHash.length > 0 && event.blockHash == transferBlockHash) {
      chainlinkRequestId = event.returnValues.id;
      document.querySelector('#loading-text').innerHTML = `CONNECTING WORD #${tokenID} TO ORACLE...`;
    }

    // Gate Chainlink fulfill on matching Chainlink id.
     if (eventName == "ChainlinkFulfilled" && chainlinkRequestId.length > 0 && event.returnValues.id == chainlinkRequestId) {
      document.querySelector('#loading-text').innerHTML = `UPDATING WORD #${tokenID} FROM ORACLE...`;
    }

    // Gate event request id on matching Chainlink id.
    if (eventName == "RemoteMintFulfilled" && chainlinkRequestId.length > 0 && event.returnValues.requestId == chainlinkRequestId) {
      let resultId = event.returnValues.resultId;
      window.location.href = `word?token=${tokenID}`;
    }
  });

  // Minting
  let mint = await contract.methods.mint(tokenID)
    .send({ from: wallet })
    .then(function(result) {
      document.querySelector('#loading-text').innerHTML = `GENERATING WORD #${tokenID}...`;
    })
    .catch(error => {
      document.querySelector('#loading-modal').style = "display:none";
      isLoading = false;
    });
}

if (document.location.href.includes("/generate")) {
  document.onload = claim();
}
