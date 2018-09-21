'use strict';

let utils = require('fabric-client/lib/utils.js');
//let log = utils.getLogger('bcClient.js');
const log = require('../utils/logger.js');
const config = require('../configuration/config.json');

let util = require('util');
let path = require('path');
let fs = require('fs');

let User = require('fabric-client/lib/User.js');

let HFC = require('fabric-client');

let EventHub = require('fabric-client/lib/EventHub.js');

let env = require('../utils/env.js');
let member = require('./common/member.js');
let channel = require('./common/channel.js');
let chaincode = require('./common/chaincode.js');
let transaction = require('./common/transaction.js');
let ledger = require('./common/ledger.js');
let grpc = require('grpc');


class BcClient {

    constructor() {
        //hfc
        this._fabricClient = null;

        //client type
        this._isAdmin = false;

        //connected Peers
        this._connectedPeers = null;
        this._eventPeers = null;

        //loaded config files
        this.clientConfig = null;
        this.channelConfig = null;

        //client settings
        this.clientOrgId = null;
        this.channelConfigDirPath = null;

        //only in dev mode
        this._devOtherAdminClients = null;
        this._devRegistrarClients = null;
    }

    getChannelPeers() {
        return this.channelConfig['orgs'];
    }

    getClientOrgId() {
        return this.clientOrgId;
    }

    getClientOrg() {
        let org = {};
        org.orgId = this.clientOrgId;
        let orgInfo = this.channelConfig['orgs'][this.clientOrgId];
        if (orgInfo) {
            org.orgName = orgInfo['name'];
            org.mspid = orgInfo['mspid'];
        }
        return org;
    }

    getCurChConfigDirPath() {
        return this.channelConfigDirPath;
    }

    isAdminClient() {
        return this._isAdmin;
    }

    getChannelName() {
        return this.channelConfig['channelName'];
    }

    getRegistrarServerAddr(orgId) {
        return this.channelConfig['orgs'][orgId]['registrarAddress'];
    }

    getConnectedEventPeers() {
        try {
            let peers = this.channelConfig['orgs'][this.clientOrgId]['peers'];
            let peerList = {};

            if (this._eventPeers) {
                this._eventPeers.forEach((eh) => {
                    peerList[eh.peerId] = peers[eh.peerId];
                    if (eh.isconnected()) {
                        peerList[eh.peerId].eventConnected = true;

                        if (Object.keys(eh._blockOnEvents).length > 0) {
                            peerList[eh.peerId].regBlockEvent = true;
                        } else {
                            peerList[eh.peerId].regBlockEvent = false;
                        }

                    } else {
                        peerList[eh.peerId].eventConnected = false;
                    }
                })
            }
            return Promise.resolve(peerList);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getClientMember() {
        try {
            let clientMember = member.getCurrentContextMember(this._fabricClient);
            return Promise.resolve(clientMember);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getRegisteredChaincodeEvents() {
        try {
            let eventList = [];
            if (this._eventPeers) {
                this._eventPeers.forEach((eh) => {
                    if (eh.isconnected()) {
                        for (let id in eh._chaincodeRegistrants) {
                            if (eh._chaincodeRegistrants.hasOwnProperty(id)) {
                                eh._chaincodeRegistrants[id].forEach((cbe) => {
                                    //   log.info(cbe.ccid);
                                    //   log.info(cbe.eventNameFilter);
                                    let txEventInfo = {
                                        'peer': eh.peerId,
                                        'ccid': cbe.ccid,
                                        'eventNameFilter': cbe.eventNameFilter
                                    };
                                    eventList.push(txEventInfo);
                                })
                            }
                        }
                    }
                })
            }
            return Promise.resolve(eventList);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    channelSetUp(chConfigDirPath) {
        log.info('setUp() ');

        try {
            this._eventPeerDisconnection();

            this._fabricClient = new HFC();
            this.channelConfigDirPath = chConfigDirPath;

            //설정 파일 로드, 캐시 삭제
            this.channelConfig = require(path.join(process.cwd(), this.channelConfigDirPath, 'channelConfig.json'));
            delete require.cache[require.resolve(path.join(process.cwd(), this.channelConfigDirPath, 'channelConfig.json'))];
            //Channel Config 파일 형식 검사
            this._checkChannelConfigFile(this.channelConfig);

            this.clientConfig = require(path.join(process.cwd(), this.channelConfigDirPath, 'settings.json'));
            delete require.cache[require.resolve(path.join(process.cwd(), this.channelConfigDirPath, 'settings.json'))];
            //Client Config 파일 형식 검사
            this._checkClientConfigFile(this.clientConfig);

            //Client type 설정 (Admin, User)
            this._isAdmin = this.clientConfig['default']['adminClient'];
            log.info(this.channelConfig['channelName']);

            //타임아웃 설정
            HFC.setConfigSetting('request-timeout', 180000);

            //시스템 고패스 덮어쓰기
            env.setGoPath(path.join(process.cwd(), config['chaincodePath']));
        }
        catch (err) {
            return Promise.reject(new Error("설정 파일 로드 오류 : " + (err.stack ? err.stack : err)));
        }

        return this._setChannelNetwork(this._fabricClient)
            .then(() => {
                return this.setClientOrg(this.clientConfig['default']['org']);
            })
            .then(() => {
                return this._setClientType();
            })
            .then(() => {
                return this._setConnectedPeers();
            })
            .catch((err) => {
                err.code = 1;
                return Promise.reject(err);
            })
            .then(() => {
                return this.setClientMember(this.clientConfig['default']['member']);
            })
            .then(() => {
                log.info("Connected to the Network!");
                return Promise.resolve(Object.keys(this._connectedPeers));
            })
            .catch((err) => {
                if (err.code) {
                    return Promise.reject(err);
                } else {
                    return Promise.resolve(Object.keys(this._connectedPeers) + '. (Failed to set Default Client Member)');
                }
            })
    }

    _setClientType() {
        if (this._isAdmin) {
            return this._createMemberFromCert(this.clientConfig['adminCertPath'] ? this.clientConfig['adminCertPath'][this.clientOrgId] : undefined,
                this.channelConfig['orgs'][this.clientOrgId]['mspid'])
                .catch((err) => {
                    return Promise.reject(new Error('Admin Mode인 경우 지정된 Org에 대한 Admin 계정이 등록되어야 합니다 - ' + err));
                })
                .then(() => {
                    return this._devCreateOtherOrgAdmins();
                })
                .then(() => {
                    return this._devCreatePreDefinedRegistrarMembers();
                })
        } else {
            return Promise.resolve();
        }
    }

    _createMemberFromCert(memberInfo, mspId, client) {
        try {
            if (!memberInfo) throw new Error('해당 멤버에 대한 계정정보(인증서, 키)가 존재하지 않습니다.');
            let params = {
                memberId: memberInfo['member'],
                adminKeyPath: path.join(this.channelConfigDirPath, memberInfo['key']),
                adminCertPath: path.join(this.channelConfigDirPath, memberInfo['cert']),
                mspId: mspId
            };
            if (!client) client = this._fabricClient;
            return member.createMember(client, params);
        }
        catch (err) {
            return Promise.reject(new Error('Failed to create member form cert : ' + err));
        }
    }

    // only in dev mode
    _devCreateOtherOrgAdmins() {
        this._devOtherAdminClients = {};
        let adminCertPath = this.clientConfig['adminCertPath'];

        if (adminCertPath && Object.keys(adminCertPath).length > 0) {
            return this._devCreateNextAdminMember(0, adminCertPath)
                .catch((err) => {
                    log.info('다른 Admin Member 등록 중 오류가 발생하였습니다. ' + err);
                })
        } else {
            return Promise.resolve('Admin Member 정보가 없습니다.');
        }
    }


    // only in dev mode
    _devCreateNextAdminMember(idx, list) {

        if (idx > (Object.keys(list).length) - 1) {
            return Promise.resolve();
        }
        let orgId = Object.keys(list)[idx];

        if (orgId == this.clientOrgId) {
            return this._devCreateNextAdminMember(idx + 1, list);
        }

        let otherAdminClient = new HFC();

        return this._setChannelNetwork(otherAdminClient)
            .then(() => {
                return this.setClientOrg(orgId, otherAdminClient)
            }).then(() => {
                log.info('mspid : ' + this.channelConfig['orgs'][orgId]['mspid']);
                return this._createMemberFromCert(list[orgId], this.channelConfig['orgs'][orgId]['mspid'], otherAdminClient)
            })
            .then(() => {
                this._devOtherAdminClients[orgId] = otherAdminClient;
                return this._devCreateNextAdminMember(idx + 1, list);
            })
    }


    // only in dev mode
    _devCreatePreDefinedRegistrarMembers() {
        this._devRegistrarClients = {};
        let registrarList = this.clientConfig['registrar'];

        if (registrarList && Object.keys(registrarList).length > 0) {
            return this._devCreateNextRegistrarMember(0, registrarList)
                .catch((err) => {
                    log.info('registrar 등록 중 오류가 발생하였습니다. ' + err);
                });
        } else {
            return Promise.resolve('registrar 정보가 없습니다.');
        }
    }

    // only in dev mode
    _devCreateNextRegistrarMember(idx, list) {

        if (idx > (Object.keys(list).length) - 1) {
            return Promise.resolve();
        }
        let orgId = Object.keys(list)[idx];

        let client = new HFC();
        let ca = this.channelConfig['orgs'][orgId]['ca'];
        let mspId = this.channelConfig['orgs'][orgId]['mspid'];

        return this.setClientOrg(orgId, client)
            .then(() => {
                return member.enroll(client, ca.url, ca.name, list[orgId]['name'], list[orgId]['password'], mspId)
            })
            .then((user) => {
                log.info(orgId + " registrar '" + user.getName() + "' 등록 완료.");
                this._devRegistrarClients[orgId] = client;
                return this._devCreateNextRegistrarMember(idx + 1, list);
            })
    }

    _setChannelNetwork(fabricClient) {
        try {
            let channel = fabricClient.newChannel(this.channelConfig['channelName']);

            let orderers = this.channelConfig['orderer'];
            for (let ordererId in orderers) {
                let pemData = fs.readFileSync(path.join(this.channelConfigDirPath, orderers[ordererId]['tls_cacerts']));
                let opts = {
                    pem: Buffer.from(pemData).toString(),
                    'ssl-target-name-override': orderers[ordererId]['server-hostname']
                };

                let orderer = fabricClient.newOrderer(orderers[ordererId]['url'], opts);
                channel.addOrderer(orderer);
                log.info('chain addOrderer : ' + ordererId + ' - ' + orderers[ordererId]['mspid'] + ' added');
            }

            let orgs = this.channelConfig['orgs'];
            for (let orgId in orgs) {
                if (orgs.hasOwnProperty(orgId)) {
                    log.info('chain addPeer : ' + orgId + ' - ' + orgs[orgId]['name'] + ' added');
                    let peers = orgs[orgId]['peers'];
                    for (let peerId in peers) {
                        if (peers.hasOwnProperty(peerId)) {
                            let pemData = fs.readFileSync(path.join(this.channelConfigDirPath, peers[peerId]['tls_cacerts']));
                            let opts = {
                                pem: Buffer.from(pemData).toString(),
                                'ssl-target-name-override': peers[peerId]['server-hostname']
                            };
                            let peer = fabricClient.newPeer(peers[peerId]['requests'], opts);
                            log.info('chain addPeer : ' + '  ' + peer + ' added');
                            channel.addPeer(peer);
                        }
                    }
                }
            }
            return Promise.resolve(fabricClient);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }

    _setConnectedPeers() {
        try {
            this._connectedPeers = {};
            let orgs = this.channelConfig['orgs'];
            for (let orgId in orgs) {
                let targets = {};
                let peers = orgs[orgId]['peers'];
                for (let peerId in peers) {
                    let pemData = fs.readFileSync(path.join(this.channelConfigDirPath, peers[peerId]['tls_cacerts']));
                    let opts = {
                        pem: Buffer.from(pemData).toString(),
                        'ssl-target-name-override': peers[peerId]['server-hostname']
                    };
                    let peer = this._fabricClient.newPeer(peers[peerId]['requests'], opts);
                    targets[peerId] = peer;
                }
                if (targets) {
                    this._connectedPeers[orgId] = targets;
                }
            }
            return Promise.resolve();
        }
        catch (err) {
            return Promise.reject(err);
        }
    }

    _setEventPeer() {
        try {
            this._eventPeerDisconnection();

            let peers = this.channelConfig['orgs'][this.clientOrgId]['peers'];
            for (let peerId in peers) {
                let pemData = fs.readFileSync(path.join(this.channelConfigDirPath, peers[peerId]['tls_cacerts']));
                let opts = {
                    pem: Buffer.from(pemData).toString(),
                    'ssl-target-name-override': peers[peerId]['server-hostname']
                };

                let eh = this._fabricClient.newEventHub();
                eh.setPeerAddr(peers[peerId]['events'], opts);
                eh.connect();
                eh['peerId'] = peerId;
                this._eventPeers.push(eh);
            }
            return Promise.resolve();
        }
        catch (err) {
            return Promise.reject(err);
        }
    }

    loadChannelConfig() {
        let channelName = this.channelConfig['channelName'];
        return channel.loadChannelConfig(this._fabricClient.getChannel(channelName))
            .then((result) => {
                let curOrderer = this._fabricClient.getChannel(channelName).getOrderers()[0];
                this._devSetNewOrdererToAllOtherAdminClients(curOrderer, channelName);
                return Promise.resolve(result);
            })
    }

    _devSetNewOrdererToAllOtherAdminClients(curOrderer, channelName) {
        for (let orgId in this._devOtherAdminClients) {
            let ch = this._devOtherAdminClients[orgId].getChannel(channelName);
            let orderers = ch.getOrderers();
            for (let i = 0; i < orderers.length; i++) {
                if (orderers[0].getUrl() === curOrderer.getUrl()) {
                    if (i > 0) {
                        log.info(orgId + '의 Admin 클라이언트의 디폴트 orderer를 ' + curOrderer.getUrl() + '으로 변경합니다.');
                    }
                    break;
                } else {
                    orderers.push(orderers.shift());
                }
            }
        }
    }

    connectEventPeer(peers) {
        try {
            let connectedPeerIdList = [];
            if (this._eventPeers) {
                this._eventPeers.forEach((eh) => {
                    if (peers.includes(eh['peerId'])) {
                        eh.connect();
                        connectedPeerIdList.push(eh['peerId']);
                    } else {
                        if (eh.isconnected()) eh.disconnect();
                    }
                })
            }
            return Promise.resolve(connectedPeerIdList.length > 0 ? connectedPeerIdList : 'No connected Event Peers');
        } catch (err) {
            return Promise.reject(err);
        }
    }


    setBlockEventListener(peerId, cb, cbErr) {
        try {
            let blockRegNum;

            if (this._eventPeers) {
                this._eventPeers.forEach((eh) => {
                    if (eh.peerId == peerId && eh.isconnected()) {
                        eh._blockOnEvents = {};
                        eh._blockOnErrors = {};
                        blockRegNum = eh.registerBlockEvent((blockInfo) => {
                            cb(blockInfo);
                        }, (err) => {
                            log.error(err);
                        });
                    } else {
                        eh._blockOnEvents = {};
                        eh._blockOnErrors = {};
                    }
                })
            }

            if (blockRegNum) {
                log.info('register block Event on peer ' + peerId + ', regNum: ' + blockRegNum);
                return Promise.resolve('register block Event on peer ' + peerId + ', regNum: ' + blockRegNum);
            } else {
                throw new Error('대상 Peer가 존재하지 않거나 event 등록에 실패하였습니다.');
            }
        } catch (err) {
            return Promise.reject(new Error('Failed to register block Event - ' + err));
        }
    }

    removeBlockEventListener() {
        try {
            this._eventPeers.forEach((eh) => {
                if (eh.isconnected()) {
                    eh._blockOnEvents = {};
                    eh._blockOnErrors = {};
                }
            })
            return Promise.resolve('clear Block Event Listener');
        } catch (err) {
            return Promise.reject(new Error('Failed to clear block event listener : ' + err));
        }
    }

    addChaincodeEventListener(peerId, ccid, eventNameFilter, cb, cbErr) {
        try {
            let cbe;

            if (this._eventPeers) {
                this._eventPeers.some((eh) => {
                    if (eh.peerId == peerId && eh.isconnected()) {
                        cbe = eh.registerChaincodeEvent(ccid, eventNameFilter, (txInfo) => {
                            cb(txInfo);
                        }, (err) => {
                            cbErr(err);
                        });
                    }
                })
            }

            if (cbe) {
                log.info('register tx Event on peer ' + peerId + ', ccid: ' + cbe.ccid + ', event: ' + cbe.eventNameFilter);
                return Promise.resolve('register tx Event on peer ' + peerId + ', ccid: ' + cbe.ccid + ', event: ' + cbe.eventNameFilter);
            } else {
                throw new Error('대상 Peer가 존재하지 않습니다.');
            }
        } catch (err) {
            return Promise.reject(new Error('Failed to register tx Event - ' + err));
        }
    }

    removeChaincodeEventListener(peer, ccid, eventNameFilter) {
        try {
            if (this._eventPeers) {
                this._eventPeers.forEach((eh) => {
                    if (eh.peerId === peer && eh.isconnected()) {
                        eh._chaincodeRegistrants[ccid].forEach((cbe) => {
                            if (cbe.eventNameFilter == eventNameFilter) {
                                eh.unregisterChaincodeEvent(cbe);
                            }
                        })
                    }
                })
            }
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    _eventPeerDisconnection() {
        if (this._eventPeers) {
            this._eventPeers.forEach((eh) => {
                if (eh.isconnected()) eh.disconnect();
            })
        }
        this._eventPeers = [];
    }

    _getTargetPeers(targetPeers) {
        let targets = [];

        if (targetPeers) {
            for (let orgId in targetPeers) {
                let peerList = this._connectedPeers[orgId];
                for (let idx in targetPeers[orgId]) {
                    targets.push(peerList[targetPeers[orgId][idx]]);
                }
            }
        } else {
            targets = targetPeers;
        }

        return targets;
    }

    _getTargetPeer(targetPeers) {
        let target;
        for (let key in targetPeers) {
            target = this._connectedPeers[key][targetPeers[key]];
            break;
        }
        return target;
    }

    setClientOrg(orgId, fabricClient) {
        if (!this.channelConfig['orgs'][orgId]) return Promise.reject(new Error("Channel Client Org가 존재하지 않습니다. clientOrgId: " + orgId));

        if (!fabricClient) {
            fabricClient = this._fabricClient;
            this.clientOrgId = orgId;
        }
        let orgName = this.channelConfig['orgs'][orgId]['name'];

        return HFC.newDefaultKeyValueStore({
            path: env.getKeyValStorePathForOrg(this.channelConfigDirPath, orgName)
        }).then((store) => {
            log.info("keyValStore Path : " + store._dir);
            fabricClient.setStateStore(store);
        })
    }

    setClientMember(name, fabricClient) {
        let client = fabricClient ? fabricClient : this._fabricClient;
        return member.getMember(client, name)
            .then((user) => {
                log.info('====================================================');
                log.info(user.getName() + ' 멤버를 Client Context에 설정하였습니다.');
                log.info('====================================================');

                if (fabricClient) {
                    return Promise.resolve();
                } else {
                    return this._setEventPeer()
                        .then(() => {
                            return this.loadChannelConfig()
                                .catch((err) => {
                                    log.error(err + ' Channel Config Load 실패! Load Channel Config를 다시 실행해야 합니다.');
                                })
                        })
                }
            })
            .catch((err) => {
                if (this._eventPeers) {
                    this._eventPeers.forEach((eh) => {
                        if (eh.isconnected()) eh.disconnect();
                    })
                }
                this._eventPeers = [];
                this._fabricClient._userContext = null;
                log.error(err);
                return Promise.reject(err);
            });
    }

    createChannel() {
        log.debug('createChannel()');
        let channelName = this.channelConfig['channelName'];
        return channel.createChannel(this._fabricClient, channelName, path.join(this.channelConfigDirPath, 'channel.tx'));
    }

    joinChannel(targetPeers) {
        log.debug('joinChannel()');
        let channelName = this.channelConfig['channelName'];

        if (Object.keys(targetPeers).length != 1) {
            return Promise.reject(new Error("targetPeers에 복수의 Org가 존재합니다."))
        }
        let targetOrgId = Object.keys(targetPeers)[0];

        let client = (targetOrgId === this.clientOrgId) ? this._fabricClient : this._devOtherAdminClients[targetOrgId];
        if (client) {
            return channel.joinChannel(client, channelName, this._getTargetPeers(targetPeers));
        } else {
            return Promise.reject(new Error("해당 org의 Admin 계정을 찾을 수 없습니다."))
        }
    }

    register(userName, orgId) {
        if (!orgId) orgId = this.clientOrgId;
        return member.getMember(this._devRegistrarClients[orgId], this.clientConfig['registrar'][orgId]['name'])
            .then((registrar) => {
                let ca = this.channelConfig['orgs'][this.clientOrgId]['ca'];
                return member.register(ca.url, ca.name, registrar, userName);
            })
    }

    enroll(userName, password) {
        let ca = this.channelConfig['orgs'][this.clientOrgId]['ca'];
        let mspId = this.channelConfig['orgs'][this.clientOrgId]['mspid'];
        return member.enroll(this._fabricClient, ca.url, ca.name, userName, password, mspId)
            .then((user) => {
                return this.setClientMember(user.getName());
            })
    }

    getMember(userName) {
        return member.getMember(this._fabricClient, userName);
    }

    installChaincode(id, path, ver, targetPeers) {
        log.debug("instChainCode()");

        let req = {
            chaincodePath: path,
            chaincodeId: id,
            chaincodeVersion: ver
        };

        let targetOrgId = Object.keys(targetPeers)[0];

        let client = (targetOrgId === this.clientOrgId) ? this._fabricClient : this._devOtherAdminClients[targetOrgId];
        if (client) {
            return chaincode.installChaincode(client, req, this._getTargetPeers(targetPeers));
        } else {
            return Promise.reject(new Error("해당 org의 Admin 계정을 찾을 수 없습니다."))
        }
    }


    instantiateChaincode(id, ccPath, ver, args, isUpgrade, targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let endorsementPolicy = require(path.join(process.cwd(), this.channelConfigDirPath, 'enPolicy.json'));

        let req = {
            chaincodeId: id,
            chaincodePath: ccPath,
            chaincodeVersion: ver,
            args: args,
            endorsementPolicy: endorsementPolicy
        };

        return chaincode.instantiateChaincode(this._fabricClient, channelName, req, this._getTargetPeers(targetPeers), this._eventPeers, isUpgrade);
    }


    queryChaincode(id, fcn, args, targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let req = {
            chaincodeId: id,
            fcn: fcn,
            args: args
        };
        return transaction.queryChaincode(this._fabricClient, channelName, req, this._getTargetPeers(targetPeers));
    }


    invokeChaincode(id, fcn, args, targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let req = {
            chaincodeId: id,
            fcn: fcn,
            args: args
        };
        return transaction.invokeChaincode(this._fabricClient, channelName, req, this._getTargetPeers(targetPeers), this._eventPeers);
    }

    queryChaincodeList(ccState, targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let targetPeer = this._getTargetPeer(targetPeers);

        let targetOrgId = Object.keys(targetPeers)[0];

        let client = (targetOrgId === this.clientOrgId) ? this._fabricClient : this._devOtherAdminClients[targetOrgId];

        if (ccState === 'instantiated') {
            return client.getChannel(channelName).queryInstantiatedChaincodes(targetPeer);
        } else {
            log.info("ccState: " + ccState);
            return client.queryInstalledChaincodes(targetPeer);
        }
    }

    queryBlock(queryBlockBy, blockParam, targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let targetPeer = this._getTargetPeer(targetPeers);
        log.debug('queryBlockBy : ' + queryBlockBy);
        log.debug('target peer : ' + targetPeer);

        if (queryBlockBy === 'number') {
            return ledger.queryBlock(this._fabricClient, channelName, Number(blockParam), targetPeer);
        } else if (queryBlockBy === 'hash') {
            return ledger.queryBlockByHash(this._fabricClient, channelName, blockParam, targetPeer);
        }
    }

    queryChannelInfo(targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let targetPeer = this._getTargetPeer(targetPeers);
        log.debug('target peer : ' + targetPeer);
        return ledger.queryChannelInfo(this._fabricClient, channelName, targetPeer);
    }

    queryTransaction(txId, targetPeers) {
        let channelName = this.channelConfig['channelName'];
        let targetPeer = this._getTargetPeer(targetPeers);
        log.debug('target peer : ' + targetPeer);
        return ledger.queryTransaction(this._fabricClient, channelName, txId, targetPeer);
    }

    queryChannels(targetPeers) {
        let targetPeer = this._getTargetPeer(targetPeers);
        log.debug('target peer : ' + targetPeer);
        return this._fabricClient.queryChannels(targetPeer);
    }


    _checkChannelConfigFile(channelConfig) {

        if (!channelConfig ||
            !channelConfig.hasOwnProperty('channelName') ||
            !channelConfig.hasOwnProperty('orderer') ||
            !channelConfig.hasOwnProperty('orgs')) {
            throw new Error("please check 'root' properties");
        }

        for (let ordererId in channelConfig['orderer']) {
            if (!channelConfig['orderer'][ordererId].hasOwnProperty('mspid') ||
                !channelConfig['orderer'][ordererId].hasOwnProperty('url') ||
                !channelConfig['orderer'][ordererId].hasOwnProperty('server-hostname') ||
                !channelConfig['orderer'][ordererId].hasOwnProperty('tls_cacerts')) {
                throw new Error("please check 'orderer' properties");
            }
        }

        for (let orgId in channelConfig['orgs']) {
            if (channelConfig['orgs'][orgId].hasOwnProperty('name') &&
                channelConfig['orgs'][orgId].hasOwnProperty('name') &&
                channelConfig['orgs'][orgId].hasOwnProperty('mspid') &&
                channelConfig['orgs'][orgId].hasOwnProperty('ca') &&
                channelConfig['orgs'][orgId]['ca'].hasOwnProperty('url') &&
                channelConfig['orgs'][orgId]['ca'].hasOwnProperty('name') &&
                channelConfig['orgs'][orgId].hasOwnProperty('peers')) {
                let peers = channelConfig['orgs'][orgId]['peers'];
                for (let peerName in peers) {
                    if (peers[peerName].hasOwnProperty('requests') &&
                        peers[peerName].hasOwnProperty('events') &&
                        peers[peerName].hasOwnProperty('server-hostname') &&
                        peers[peerName].hasOwnProperty('tls_cacerts')) {
                    } else {
                        throw new Error("please check '" + orgId + "', 'peer[" + idx + "] properties");
                    }
                }
            } else {
                throw new Error("please check '" + orgId + "' properties");
            }
        }
    }

    _checkClientConfigFile(clientConfig) {
        if (!clientConfig ||
            !clientConfig.hasOwnProperty('default')) {
            throw new Error("please check 'default' property");
        }
    }
}

const bcClient = new BcClient;
module.exports = bcClient;

