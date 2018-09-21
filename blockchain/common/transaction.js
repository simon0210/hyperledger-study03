'use strict';

const log = require('../../utils/logger.js');

let util = require('util');
let path = require('path');
let fs = require('fs');

let User = require('fabric-client/lib/User.js');

let EventHub = require('fabric-client/lib/EventHub.js');

let env = require('../../utils/env.js');
let member = require('./member.js');
let channelLib = require('./channel.js');

function queryChaincode(client, channelName, req, targets) {
    log.debug('queryChaincode(' + req.chaincodeId + ', ' + req.fcn + ', [' + req.args + '])');
    log.info("Query Targets : " + targets);

    return new Promise(function (resolve, reject) {
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to query ~');

        let channel = client.getChannel(channelName);
        let tx_id = client.newTransactionID();

        // send query
        let request = {
            targets: targets,
            chaincodeId: req.chaincodeId,
            txId: tx_id,
            fcn: req.fcn,
            args: req.args ? req.args : []
        };

        return channel.queryByChaincode(request)
            .then((response_payloads) => {
                if (response_payloads) {
                    let result = [];
                    for (let i = 0; i < response_payloads.length; i++) {
                        result.push((response_payloads[i] instanceof Error) ? response_payloads[i] : response_payloads[i].toString('utf8'));
                      //  log.info(response_payloads[i].toString('utf8'));
                    }
                    resolve(result);
                } else {
                    log.error('Failed to get response on query - response_payloads is null');
                    reject(new Error('Failed to get response on query - response_payloads is null'));
                }
            })
            .catch((err) => {
                if(err instanceof Error) {
                    log.error('Failed to query. ' + (err.stack ? err.stack : err));
                    reject(err);
                } else {
                    log.error('Failed to query - ' + err?err:'No Error Info');
                    reject(new Error('Failed to query - ' + err?err:'No Error Info'));
                }
            });
        });
}
module.exports.queryChaincode = queryChaincode;

function invokeChaincode(client, channelName, req, targets, eventhubs) {
    log.debug('invokeChaincode(' + req.chaincodeId + ', ' + req.fcn + ', [' + req.args + '])');
    log.info("Invoke Targets : " + targets);

    return new Promise(function (resolve, reject) {
        let invoker = member.getCurrentContextMember(client);
        log.info('Member \'' + invoker.getName() + '\' try to invoke ~');

        let channel = client.getChannel(channelName);
        let tx_id;

        /*
        return channel.initialize()
            .then(() => {
                tx_id = client.newTransactionID();
                log.info(util.format('Sending transaction "%s"', JSON.stringify(tx_id._transaction_id)));

                // send proposal to endorser
                let request = {
                    targets: targets,
                    chaincodeId: req.chaincodeId,
                    fcn: req.fcn,
                    args: req.args,
                    txId: tx_id
                };
                return channel.sendTransactionProposal(request);
            })
        */

        tx_id = client.newTransactionID();
        log.info(util.format('Sending transaction "%s"', JSON.stringify(tx_id._transaction_id)));

        // send proposal to endorser
        let request = {
            targets: targets,
            chaincodeId: req.chaincodeId,
            fcn: req.fcn,
            args: req.args,
            txId: tx_id
        };
        return channel.sendTransactionProposal(request)
            .then((results) => {
                let proposalResponses = results[0];
                let proposal = results[1];
                let header = results[2];
                let errorResponse = undefined;

                for (let i in proposalResponses) {
                    if (proposalResponses[i] && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                        log.info('transaction proposal has response status of good');
                        if (channel.verifyProposalResponse(proposalResponses[i])) {
                            log.info(' - transaction proposal signature and endorser are valid');
                        }else{
                            errorResponse = new Error('transaction proposal signature and endorser are invalid!');
                        }
                    } else {
                        log.error('transaction proposal was bad : ' + proposalResponses[i]);
                        errorResponse = (proposalResponses[i] instanceof Error)? proposalResponses[i] : new Error(proposalResponses[i]);
                    }
                }
                if (!errorResponse) {
                    if (channel.compareProposalResponseResults(proposalResponses)) {
                        log.info('compareProposalResponseResults exection did not throw');
                        log.info(' All proposals have a matching read/writes sets');
                    }
                    else {
                        log.error(' All proposals do not have matching read/write sets');
                        errorResponse = new Error('proposals do not have matching read/write sets');
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
                                    eh.unregisterTxEvent(deployId);
                                    reject(new Error("eventhub time out"));
                                }, 60000);

                                eh.registerTxEvent(deployId.toString(),
                                    (tx, code) => {
                                        clearTimeout(handle);
                                        eh.unregisterTxEvent(deployId);

                                        if (code !== 'VALID') {
                                            log.error('The transaction was invalid, code = ' + code);
                                            reject(new Error('The transaction was invalid, code = ' + code + ' on peer ' + eh.getPeerAddr()));
                                        } else {
                                            log.info('The transaction was valid.');
                                            log.info('The transaction has been committed on peer ' + eh.getPeerAddr());
                                            resolve();
                                        }
                                    },
                                    (err) => {
                                        clearTimeout(handle);
                                        log.info('Eventhub is shutdown for ' + deployId + ' err : ' + err);
                                        reject(new Error('Eventhub is shutdown for ' + deployId + ' err : ' + err));
                                    });
                            });
                            eventPromises.push(txPromise);
                        }
                    });

                    let sendPromise = channel.sendTransaction(request)
                        .catch((err)=>{
                            log.error('지정된 Orderer에 연결이 불가능합니다. ');
                            channelLib.loadChannelConfig(channel)
                                .catch((err)=>{
                                    log.info(err);
                                });
                         //   return Promise.reject(err);
                            throw err;
                        });

                    return Promise.all([sendPromise].concat(eventPromises))
                        .then((results) => {
                            log.debug('Event promise all complete and testing complete');
                            return results[0]; // just first results are from orderer, the rest are from the peer events
                        }).catch((err) => {
                            if(err && err instanceof Error){
                                log.error('Failed to send transaction - ' + err);
                                throw err;
                            }else{
                                log.error('Failed to send transaction - ' + (err? err: 'Failed to get notifications within the timeout period'));
                                throw new Error('Failed to send transaction - ' + (err? err: 'Failed to get notifications within the timeout period'));
                            }
                        });
                } else {
                    log.error(errorResponse);
                    throw errorResponse;
                }
            })
            .then((response) => {
                if (!(response instanceof Error) && response.status === 'SUCCESS') {
                    log.info(JSON.stringify(response));
                    log.info('Successfully sent transaction to the orderer.');
                    log.info('******************************************************************');
                    log.info('export TX_ID=' + '\'' + tx_id.getTransactionID() + '\'');
                    log.info('******************************************************************');
                    resolve('TX_ID=' + '\'' + tx_id.getTransactionID() + '\'');
                } else {
                    if(response instanceof Error){
                        log.error('Failed to the transaction. ' + (response.stack ? response.stack : response));
                        reject(response);
                    }else{
                        log.error('Failed to order the transaction - ' + (response? response: 'No Error Info'));
                        reject(new Error('Failed to order the transaction - ' + (response? response: 'No Error Info')));
                    }
                }
            })
            .catch((err) => {
                if(err instanceof Error){
                    log.error('Failed to transaction. ' + (err.stack ? err.stack : err));
                    reject(err);
                }else{
                    log.error('Failed to send transaction - ' + (err? err: 'No Error Info'));
                    reject(new Error('Failed to send transaction - ' + (err? err: 'No Error Info')));
                }
            });
    });
}
module.exports.invokeChaincode = invokeChaincode;
