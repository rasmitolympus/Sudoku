import { LightningElement,track } from 'lwc';
import { subscribe, unsubscribe, onError, setDebugFlag, isEmpEnabled } from 'lightning/empApi';

import publishJoinConfirmationFromApex from '@salesforce/apex/PublishTicTacToeGameEvent.sendJoinConfirmation';
import playMoveForReciver from '@salesforce/apex/PublishTicTacToeGameEvent.playMove'; 
import publishStartAgain from '@salesforce/apex/PublishTicTacToeGameEvent.publishStartAgain';
import publishPlayerLeft from '@salesforce/apex/PublishTicTacToeGameEvent.publishPlayerLeft';
import publishRematch from '@salesforce/apex/PublishTicTacToeGameEvent.publishRematch';

export default class TicTacToe extends LightningElement {

    @track gameBlock = [];
    renderComplete = false;
    activeGame = false;
    currentColor = 'white';
    currentSymbol = 'X';
    channelName = '/event/TicTocEvent__e';
    subscription;
    selectedChannel;
    receiverPlayerName;
    senderPlayerName;
    senderGameId;
    receiverGameId;
    showOverLay = false;
    winningOrLoseMsg;
    winningOrLose = false;
    progress = 1;
    showProgress = false;
    isRematch = false;
    isPlayerLeft = false;

    renderedCallback(){
        if(!this.renderComplete){
            this.renderComplete = true;
            this.setGameBlock();
        }
    }

    disconnectedCallback(){
        unsubscribe(this.subscription, respose => {
            console.log(response);
        })
    }

    subscribeGameEvents(){
        const messageCallback = (response) => {
            console.log('New message received: ', JSON.stringify(response));
            const payloadString = JSON.stringify(response);
            const payload = JSON.parse(payloadString).data.payload;
            console.log(payload);
            if(payload.Game_Id__c === this.receiverGameId){
                this.triggerActions(payload);
            }else if(payload.action__c === 'join game'){
                console.log(this.senderGameId)
                if(payload.Game_Id__c === this.senderGameId){
                    if(this.receiverGameId === undefined || this.receiverGameId === '')
                        this.joinGame(payload);
                }
            }
        };

        console.log(this.channelName);

        subscribe(this.channelName,-1,messageCallback)
        .then(response => {
            console.log(response);
            this.subscription = response;
        });
    }

    startAgain(){
        publishStartAgain({senderId : this.senderGameId})
        .then(data => {
            this.activateGame();
            this.winningOrLose = false;
            this.showOverLay = true;
        })
    }

    rematch(){
        publishRematch({senderId : this.senderGameId})
        .then(data=> {
            console.log(data);
            this.renderComplete = false;
            this.winningOrLose = false;
            this.isRematch = false;
            this.renderedCallback();
            this.activateGame();
            this.showProgress = true;
            this.progress = 1;
            this.setIntervalFunction();
        })
    }

    exitGame(){
        if(this.isRematch){
            publishPlayerLeft({senderId : this.senderGameId})
            .then(data => {
                console.log(data);
            })
            .catch(error => {
                console.log(error);
            })
        }
        this.isPlayerLeft = false;
        this.winningOrLose = false;
        this.showOverLay = false;
        this.isRematch = false;
        this.activeGame = false;
        this.renderComplete = false;
        this.renderedCallback();
    }

    get getRandomId(){
        return Math.floor(Math.random() * (100000000 - 10000000) ) + 10000000 + '';
    }

    joinGame(payload){
        this.receiverGameId = this.getRandomId;
        this.receiverPlayerName = payload.PlayerName__c;
        console.log(this.receiverPlayerName);
        //send join confrimation
        publishJoinConfirmationFromApex({receiverGameId : this.senderGameId,senderGameId : this.receiverGameId, playerName : this.senderPlayerName})
        .then(data => {
            console.log(data);
            this.activateGame();
            this.showProgress = true;
            this.progress = 1;
            this.setIntervalFunction();
        })
        .catch(error => {
            console.log(error);
        })
    }

    setReceiverId(event){
        this.subscribeGameEvents();
        this.receiverGameId = event.detail.receiverGameId;
        this.senderPlayerName = event.detail.senderPlayerName;
        this.selectedChannel = 'online';
    }
    
    triggerActions(payload){
        switch(payload.action__c){
            case 'join confirmation':
                this.senderGameId = payload.SenderGameId__c;
                this.receiverPlayerName = payload.PlayerName__c;
                console.log(this.receiverPlayerName);
                console.log('startgame');
                this.activateGame();
                this.showOverLay = true;
                break;
            case 'receiver move':
                this.showOverLay = false;
                this.playMove(payload.corditnate__c);
                if(this.checkForWinning(this.currentSymbol,payload.corditnate__c)){
                    this.winningOrLoseMsg = 'You lose';
                    this.winningOrLose = true;
                }else{
                    this.showProgress = true;
                    this.progress = 1;
                    this.setIntervalFunction();
                }
                break;
            case 'start again':
                if(this.winningOrLose){
                    this.isRematch = true;
                }else{
                    publishPlayerLeft({senderId: this.senderGameId})
                    .then(data => {
                        console.log(data);
                    })
                    .catch(error => {
                        console.log(error);
                    })
                }
                break;
            case 'player left':
                this.isPlayerLeft = true;
                break;
            case 'Publish Rematch':
                this.winningOrLose = false;
                this.renderComplete = false;
                this.isRematch = false;
                this.renderedCallback();
                this.activateGame();
                break;
            default:
                break;
        }
    }

    activateGame(){
        console.log(this.activeGame);
        this.activeGame = true;
        this.isPlayerLeft = false;
        console.log(this.activeGame);
    }

    setIntervalFunction(){
        this.timeOutVar = setInterval(() => {
            console.log('under interval function ' + this.progress);
            if(this.progress === 100){
                console.log('under clear interval');
                this.clearIntervalFun();
            }else{
                this.progress +=1;
            }
        }, 300);
    }

    clearIntervalFun(){
        if(this.progress === 100){
            this.winningOrLose = true;
            if(this.selectedChannel === 'offline'){
                if(this.currentSymbol === 'O')
                    this.winningOrLoseMsg = 'Time over \n' + this.receiverPlayerName + ' lose!';
                else
                    this.winningOrLoseMsg = 'Time over \n' + this.senderPlayerName + ' lose!';
            }

            //Add time interval logic for online player
        }
    }

    setGameBlock(){
        this.gameBlock = [];
        for(let x = 0; x < 3; x++){
            for(let y = 0; y < 3; y++){
                let obj;

                obj = {
                    class: 'blank',
                    cordinate: `${x} : ${y}`,
                    label: 'T'
                }
                this.gameBlock.push(obj);
            }
        }
        console.log(this.gameBlock);
    }

    handleBlock(event){
        clearInterval(this.timeOutVar);
        this.showProgress = false;
        let targetId = event.target.dataset.targetId;
        if(this.gameBlock[this.getIndexByCordinate(targetId)].class !== 'blank'){
            return false;
        }
        const win = this.playMove(targetId);
        if(this.selectedChannel === 'online'){
            playMoveForReciver({cordinate : targetId,senderId : this.senderGameId})
            .then(data => {
                console.log(data);
            })
            .catch(error => {
                console.log(error);
            })
        }
        if(!win){
            if(this.selectedChannel === 'online')
                this.showOverLay = true;
            else{
                this.progress = 0;
                this.setIntervalFunction();
            }
        }else{
            if(this.selectedChannel === 'offline'){
                if(this.currentSymbol === 'O'){
                    this.winningOrLoseMsg = this.senderPlayerName + ' win!';
                }else{
                    this.winningOrLoseMsg = this.receiverPlayerName + ' win!';
                }
            }else{
                this.winningOrLoseMsg = 'You win!';
            }
            this.winningOrLose = true;
        }
    }

    playMove(currentCordinate){
        const currentIndex = this.getIndexByCordinate(currentCordinate);
        this.gameBlock[currentIndex].class = this.currentColor === 'black' ? 'white' : 'black';
        this.currentColor = this.currentColor === 'black' ? 'white' : 'black';
        this.gameBlock[currentIndex].label = this.currentSymbol === 'X' ? 'O' : 'X';
        this.currentSymbol = this.currentSymbol === 'X' ? 'O' : 'X';
        return this.checkForWinning(this.currentSymbol,currentCordinate);
    }

    checkForWinning(currentSymbol,currentCordinate){
        console.log(currentSymbol);
        let xandy = currentCordinate.split(' : ');
        let x = 8 - Number(xandy[0]) === 8 ? 0 : 8 - Number(xandy[0]) === 7 ? 3 : 6;
        let y = 8 - Number(xandy[1]) === 8 ? 0 : 8 - Number(xandy[1]) === 7 ? 1 : 2;

        console.log(x);
        console.log(y);

        for(let i = x; i < x+3; i++){
            if(this.gameBlock[i].label !== currentSymbol){
                break;
            }
            if(i === x+3 -1){
                return true;
            }
        }

        for(let i = y; i <= y+6; i+=3){
            if(this.gameBlock[i].label !== currentSymbol){
                break;
            }
            if(i === y+6){
                return true;
            }
        }

        if(xandy[0] === xandy[1]){
            for(let i = 0; i <= 8; i+=4){
                if(this.gameBlock[i].label !== currentSymbol)
                    break;
                if(i === 8){
                    return true;
                }
            }
        }

        if(Number(xandy[0]) + Number(xandy[1]) === 2){
            for(let i = 2; i <= 6; i+=2){
                if(this.gameBlock[i].label !== currentSymbol)
                    break;
                if(i === 6){
                    return true;
                }
            }
        }

        return false;
    }

    getIndexByCordinate(currentCordinate){

        let currentIndex = this.gameBlock.findIndex(
            (x) => x.cordinate === currentCordinate
        );

        return currentIndex;
    }

    startGame(event){
        this.selectedChannel = event.detail.selectedChannel;
        if(this.selectedChannel === 'online'){
            this.subscribeGameEvents();
            this.senderGameId = this.getRandomId;
            this.template.querySelector('c-tic-tac-toe-panel').waitForPlayer(this.senderGameId);
        }else{
            console.log(this.selectedChannel)
            this.receiverPlayerName = event.detail.opponentName;
            this.setIntervalFunction();
            this.activateGame();
        }
        this.senderPlayerName = event.detail.playerName;
    }
}