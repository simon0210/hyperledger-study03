'use strict';

let utils = require('fabric-client/lib/utils.js');
let util = require('util');
let path = require('path');
let fs = require('fs');

const log = require('../../utils/logger.js');

let User = require('fabric-client/lib/User.js');
let EventHub = require('fabric-client/lib/EventHub.js');

let env = require('../../utils/env.js');
let member = require('./member.js');

let isLoadingConfig = false;

function createChannel(client, channelName, txFilePath) {
    log.debug('createChannel()');

    return new Promise(function (resolve, reject) {
        let orderer = client.getChannel(channelName).getOrderers()[0];
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to create channel ~');

        let envelope_bytes = fs.readFileSync(txFilePath);
        let config = client.extractChannelConfig(envelope_bytes);

        let signatures = [];
        let signature = client.signChannelConfig(config);
        signatures.push(signature);

        let tx_id = client.newTransactionID();

        let request = {
            config: config,
            signatures: signatures,
            name: channelName,
            orderer: orderer,
            txId: tx_id
        };

        // send to create request to orderer
        return client.createChannel(request)
            .then((result) => {
                resolve(result);
            })
            .catch((err) => {
                if (err instanceof Error) {
                    log.error('Failed to create channel. ' + (err.stack ? err.stack : err));
                    reject(err);
                } else {
                    log.error('Failed to create channel - ' + (err ? err : 'No Error Info'));
                    reject(new Error('Failed to create channel - ' + (err ? err : 'No Error Info')));
                }
            });
    });
}

module.exports.createChannel = createChannel;

function joinChannel(client, channelName, targets) {
    log.debug('joinChannel()');

    return new Promise(function (resolve, reject) {
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to get the genesis block ~');

        let channel = client.getChannel(channelName);
        let tx_id = client.newTransactionID();

        let request = {
            txId: tx_id
        };

        return channel.getGenesisBlock(request)
            .then((genesis_block) => {
                log.info('Successfully got the genesis block');

                tx_id = client.newTransactionID();
                let request = {
                    targets: targets,
                    block: genesis_block,
                    txId: tx_id
                };
                return channel.joinChannel(request);
            })
            .then((results) => {
                let errorResponse = undefined;

                for (let i in results) {
                    if (!results[i].response || results[i].response.status !== 200) {
                        if (results[i] instanceof Error) {
                            errorResponse = results[i]; //save the last error object in responses
                        } else {
                            errorResponse = new Error("wrong result");
                        }
                        break;
                    }
                }
                if (errorResponse) {
                    log.error(' Failed to join channel. ' + errorResponse);
                    reject(errorResponse);
                } else {
                    log.info('Successfully joined peers in organization ' + invoker._mspId);
                    resolve('Successfully joined peers in organization ' + invoker._mspId);
                }
            })
            .catch((err) => {
                if (err instanceof Error) {
                    log.error('Failed to join channel. ' + (err.stack ? err.stack : err));
                    reject(err);
                } else {
                    log.error('Failed to join channel - ' + (err ? err : 'No Error Info'));
                    reject(new Error('Failed to join channel - ' + (err ? err : 'No Error Info')));
                }
            });
    })
}

module.exports.joinChannel = joinChannel;

function loadChannelConfig(curChannel) {

    if (!isLoadingConfig) {
        isLoadingConfig = true;
        return _loadChannelConfig(curChannel, 0)
            .then((result) => {
                isLoadingConfig = false;
                log.info(JSON.stringify(result));
                return Promise.resolve(result);
            })
            .catch((err) => {
                isLoadingConfig = false;
                return Promise.reject(err);
            })
    } else {
        return Promise.reject(new Error('이전 loadChannelConfig 요청이 아직 실행 중 입니다.'));
    }
}

module.exports.loadChannelConfig = loadChannelConfig;

function _loadChannelConfig(curChannel, index) {
    log.info('Loading Channel Config... Orderer URL : ' + curChannel.getOrderers()[0].getUrl());

    return curChannel.initialize()
        .then((result) => {
            log.info('Orderer(' + curChannel.getOrderers()[0].getUrl() + ')의 Channel Config 정보를 로드하였습니다.');
            return Promise.resolve(result);
        })
        .catch((err) => {
            if (err.toString().endsWith('NOT_FOUND')) {
                return Promise.reject(new Error("'Create Channel'을 수행한 후에 Channel initialize를 수행하십시오."));
            } else if (err.toString().endsWith('FORBIDDEN')) {
                return Promise.reject(new Error("접근 권한을 확인하십시오."));
            } else {
                log.error('Orderer(' + curChannel.getOrderers()[0].getUrl() + ')에 연결이 불가능 합니다.');
                if ((index + 1) >= curChannel.getOrderers().length) {
                    return Promise.reject(new Error('Orderer Service Unavailable!!'));
                } else {
                    let orderers = curChannel.getOrderers();
                    orderers.push(orderers.shift());
                    log.info('다른 Orderer(' + curChannel.getOrderers()[0].getUrl() + ')에 연결 시도합니다...');
                    return _loadChannelConfig(curChannel, index + 1);
                }
            }
        })
}