'use strict';

const log = require('../../utils/logger.js');
let member = require('./member.js');

function queryBlock(client, channelName, blockNumber, targetPeer) {
    try{
        let invoker = member.getCurrentContextMember(client);
        log.debug('Member \'' + invoker.getName() + '\' try to query block ~');
        let channel = client.getChannel(channelName);

        return channel.queryBlock(blockNumber, targetPeer);
    }catch(err){
        return Promise.reject(new Error('Failed to query block - ' + err));
    }

}
module.exports.queryBlock = queryBlock;

function queryBlockByHash(client, channelName, blockHash, targetPeer) {
    try{
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to query block by hash ~');
        let channel = client.getChannel(channelName);
        let buf = Buffer.from(blockHash, 'Hex');

        return channel.queryBlockByHash(buf, targetPeer);
    }catch(err){
        return Promise.reject(new Error('Failed to query block by hash - ' + err));
    }
}
module.exports.queryBlockByHash = queryBlockByHash;

function queryChannelInfo(client, channelName, targetPeer) {
    try{
        let invoker = member.getCurrentContextMember(client);
        log.debug('Member \'' + invoker.getName() + '\' try to query channel info ~');
        let channel = client.getChannel(channelName);

        return channel.queryInfo(targetPeer);
    }catch(err){
        return Promise.reject(new Error('Failed to query channel info - ' + err));
    }
}
module.exports.queryChannelInfo = queryChannelInfo;

function queryTransaction(client, channelName, txId, targetPeer) {
    try{
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to query transaction ~');
        let channel = client.getChannel(channelName);

        return channel.queryTransaction(txId, targetPeer);
    }catch(err){
        return Promise.reject(new Error('Failed to query transaction - ' + err));
    }
}
module.exports.queryTransaction = queryTransaction;

