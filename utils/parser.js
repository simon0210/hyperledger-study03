let path = require('path');
let fs = require('fs-extra');

//let log = require('fabric-client/lib/utils.js').getLogger('Member');
const log  = require('./logger.js');
let socket_io = require('./socket.js');


exports.blockParse = function(block) {

    let blockData = {};
    log.info('Block Received - BlockNum : ' + block.header.number + ', TxNum : ' + block.data.data.length);
    blockData.number = block.header.number;
    blockData.previous_hash = block.header.previous_hash;
    blockData.txList = [];
    let data = block.data.data;
    blockData.txNum = data.length;
    for(let idx in data){
        let tx = {};
        tx.tx_id = data[idx].payload.header.channel_header.tx_id;
        tx.timestamp = data[idx].payload.header.channel_header.timestamp;

        tx.actions = [];
        let actions = data[idx].payload.data.actions;
        for(let i in actions){
            let action = {};
            action.input = (new Buffer(actions[i].payload.chaincode_proposal_payload.input)).toString('utf-8');
            action.response = actions[i].payload.action.proposal_response_payload.extension.response;
            action.endorsements = [];

            let endorsements = actions[i].payload.action.endorsements
            for(let j in endorsements){
                action.endorsements.push(endorsements[j].endorser.Mspid)
            }

            tx.actions.push(action);
        }
        blockData.txList.push(tx);
    }

  //  log.info(blockData);
    socket_io.emit('blockEvent', blockData);
	return blockData;
};

exports.transactionEventParse = function(tx) {
    let txInfo = {};
    txInfo.chaincode_id = tx.chaincode_id;
    txInfo.tx_id = tx.tx_id;
    txInfo.event_name = tx.event_name;
    txInfo.payload = (new Buffer(tx.payload)).toString('utf-8');

    log.info(txInfo);
    socket_io.emit('chaincodeEvent', txInfo);
    return txInfo;
};


exports.transactionParse = function(tx) {
    let txInfo = {};
    txInfo.tx_id = tx.transactionEnvelope.payload.header.channel_header.tx_id;
    txInfo.timestamp = tx.transactionEnvelope.payload.header.channel_header.timestamp;
    log.info("tx_id : " + txInfo.tx_id);
    log.info("timestamp : " + txInfo.timestamp);

    txInfo.actions = [];
    let actions = tx.transactionEnvelope.payload.data.actions;
    for(let i in actions){
        let action = {};
        action.input = (new Buffer(actions[i].payload.chaincode_proposal_payload.input)).toString('utf-8');
        action.response = actions[i].payload.action.proposal_response_payload.extension.response;
        action.endorsements = [];

        let endorsements = actions[i].payload.action.endorsements
        for(let j in endorsements){
            action.endorsements.push(endorsements[j].endorser.Mspid)
        }

        txInfo.actions.push(action);
    }
    return txInfo;
};
