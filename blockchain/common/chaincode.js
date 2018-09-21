'use strict';

let utils = require('fabric-client/lib/utils.js');
//let log = utils.getLogger('bcClient.js');
const log = require('../../utils/logger.js');

let util = require('util');
let path = require('path');
let fs = require('fs');

let User = require('fabric-client/lib/User.js');
let EventHub = require('fabric-client/lib/EventHub.js');

let env = require('../../utils/env.js');
let member = require('./member.js');


function installChaincode(client, req, targets) {
    log.debug("instChainCode()");
    log.info("Install Targets : " + targets);

    return new Promise(function (resolve, reject) {
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to install chaincode ~');

        let request = {
            targets: targets,
            chaincodePath: req.chaincodePath,
            chaincodeId: req.chaincodeId,
            chaincodeVersion: req.chaincodeVersion
        };

        return client.installChaincode(request)
            .then((results) => {
                let proposalResponses = results[0];
                log.debug("proposalResponses: " + JSON.stringify(proposalResponses));
                let proposal = results[1];
                let errorResponse = undefined;

                for (let i in proposalResponses) {
                    if (proposalResponses[i] && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                        log.info('install proposal was good');
                    } else {
                        log.error('install proposal was bad : ' + proposalResponses[i]);
                        //save the last error object in responses
                        errorResponse = (proposalResponses[i] instanceof Error)? proposalResponses[i] : new Error(proposalResponses[i]);
                    }
                }
                if (errorResponse) {
                    log.error('Received wrong response : ' + errorResponse);
                    reject(errorResponse);
                } else {
                    log.info(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
                    resolve('Successfully sent install Proposal and received ProposalResponse');
                }
            })
            .catch((err) => {
                if(err instanceof Error) {
                    log.error('Failed to install chaincode. ' + (err.stack ? err.stack : err));
                    reject(err);
                } else {
                    log.error('Failed to install chaincode - ' + (err? err: 'No Error Info'));
                    reject(new Error('Failed to install chaincode - ' + (err? err: 'No Error Info')));
                }
            });
    });
}
module.exports.installChaincode = installChaincode;


function instantiateChaincode(client, channelName, req, targets, eventhubs, isUpgrade) {
    log.debug("initChainCode()");
    log.info("chaincodeId: " + req.chaincodeId);
    log.info("chaincodeVersion: " + req.chaincodeVersion);
    log.info("args: " + req.args);
    log.info("endorsementPolicy: " + JSON.stringify(req.endorsementPolicy));
    log.info("Install Targets : " + targets);

    return new Promise(function (resolve, reject) {
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to instantiate chaincode ~');

        let channel = client.getChannel(channelName);

        let type = 'Instantiate';
        if (isUpgrade) {
            type = 'Upgrade'
        }

        log.info("type: " + type);

        let tx_id;

        return channel.initialize()
            .then(() => {
                tx_id = client.newTransactionID();
                // send proposal to endorser
                let request = {
                    targets: targets,
                    chaincodePath: req.chaincodePath,
                    chaincodeId: req.chaincodeId,
                    chaincodeVersion: req.chaincodeVersion,
                    fcn: 'init',
                    args: req.args,
                    txId: tx_id,
                    'endorsement-policy': req.endorsementPolicy
                };

                if (isUpgrade) {
                    log.info('Upgrade...');
                    return channel.sendUpgradeProposal(request);
                } else {
                    log.info('Instantiate...');
                    return channel.sendInstantiateProposal(request);
                }

            })
            .then((results) => {
                let proposalResponses = results[0];
                let proposal = results[1];
                let header = results[2];
                let errorResponse = undefined;

                for (let i in proposalResponses) {
                    if (proposalResponses[i] && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                        log.info(type + ' proposal was good');
                    } else {
                        log.error(type + ' proposal was bad : ' + proposalResponses[i]);
                        //save the last error object in responses
                        errorResponse = (proposalResponses[i] instanceof Error)? proposalResponses[i] : new Error(proposalResponses[i]);
                    }
                }

                if (!errorResponse) {
                    log.info(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
                    let request = {
                        proposalResponses: proposalResponses,
                        proposal: proposal,
                        header: header
                    };

                    let deployId = tx_id.getTransactionID();

                    let eventPromises = [];
                    eventhubs.forEach((eh) => {
                        if(eh.isconnected()){
                            let txPromise = new Promise((resolve, reject) => {
                                let handle = setTimeout(() => {
                                    log.debug("eventhub time out");
                                    reject(new Error("eventhub time out"));
                                }, 60000);

                                eh.registerTxEvent(deployId.toString(),
                                    (tx, code) => {
                                        clearTimeout(handle);
                                        eh.unregisterTxEvent(deployId);

                                        if (code !== 'VALID') {
                                            log.error('The chaincode ' + type + ' transaction was invalid, code = ' + code);
                                            reject(new Error('The chaincode ' + type + ' transaction was invalid, code = ' + code + ' on peer ' + eh.getPeerAddr()));
                                        } else {
                                            log.info('The chaincode ' + type + ' transaction was valid.');
                                            log.info('The chaincode ' + type + ' transaction has been committed on peer ' + eh.getPeerAddr());
                                            resolve();
                                        }
                                    },
                                    (err) => {
                                        clearTimeout(handle);
                                        log.info('Eventhub is shutdown for ' + deployId + ' err : ' + err);
                                        reject(new Error('Eventhub is shutdown for ' + deployId + ' err : ' + err));
                                    }
                                );
                            });
                            log.info('register eventhub %s with tx=%s', eh.getPeerAddr(), deployId);
                            eventPromises.push(txPromise);
                        }
                    });

                    let sendPromise = channel.sendTransaction(request);
                    return Promise.all([sendPromise].concat(eventPromises))
                        .then((results) => {
                            log.debug('Event promise all complete and testing complete');
                            return results[0]; // just first results are from orderer, the rest are from the peer events
                        }).catch((err) => {
                            if(err && err instanceof Error){
                                log.error('Failed to send ' + type + ' transaction. Error : ' + err);
                                throw err;
                            }else{
                                log.error('Failed to send ' + type + ' transaction. Error : ' + (err? err: 'Failed to get notifications within the timeout period'));
                                throw new Error('Failed to send ' + type + ' transaction. Error : ' + (err? err: 'Failed to get notifications within the timeout period'));
                            }
                        })
                } else {
                    log.error(errorResponse);
                    throw (errorResponse);
                }
            })
            .then((response) => {
                if (!(response instanceof Error) && response.status === 'SUCCESS') {
                    log.info('Successfully sent ' + type + 'transaction to the orderer.');
                    resolve()
                } else {
                    if(response instanceof Error){
                        log.error('Failed to ' + type + '. ' + (response.stack ? response.stack : response));
                        reject(response);
                    }else{
                        log.error('Failed to order ' + type + ' - ' + (response? response: 'No Error Info'));
                        reject(new Error('Failed to order ' + type + ' - ' + (response? response: 'No Error Info')));
                    }
                }
            })
            .catch((err) => {
                if(err instanceof Error){
                    log.error('Failed to ' + type + '. ' + (err.stack ? err.stack : err));
                    reject(err);
                }else{
                    log.error('Failed to ' + type + ' - ' + (err? err: 'No Error Info'));
                    reject(new Error('Failed to ' + type + ' - ' + (err? err: 'No Error Info')));
                }
            });
    });

}
module.exports.instantiateChaincode = instantiateChaincode;
