'use strict';

let path = require('path');
let fs = require('fs-extra');
let util = require('util');

const log = require('../../utils/logger.js');

let copService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
let User = require('fabric-client/lib/User.js');

let env = require('../../utils/env.js');

let tlsOptions = {
    trustedRoots: [],
    verify: false
};

function register(caUrl, caName, registrar, userName, affiliation, role, enrollmentSecret) {
//enrollmentID, enrollmentSecret, role, affiliation, maxEnrollments, attr
    log.debug('register() => ' + userName);

    let cop = new copService(caUrl, tlsOptions, caName);

    return cop.register({
        enrollmentID: userName,
        enrollmentSecret: enrollmentSecret ? enrollmentSecret : undefined,
        role: role ? role : 'client',
        affiliation: affiliation ? affiliation : 'org1.department1'
    }, registrar);
}
module.exports.register = register;


function enroll(client, caUrl, caName, userName, password, mspId) {
    log.debug('enroll() => ' + userName);

    let member = new User(userName);

    let cryptoSuite = client.getCryptoSuite();
    member.setCryptoSuite(cryptoSuite);

    let cop = new copService(caUrl, tlsOptions, caName, cryptoSuite);

    return cop.enroll({
        enrollmentID: userName,
        enrollmentSecret: password
    })
        .then((enrollment) => {
            log.info('!!!Successfully enrolled user \'' + userName + '\'');
            return member.setEnrollment(enrollment.key, enrollment.certificate, mspId);
        })
        .then(() => {
            return client.setUserContext(member, false);
        })
        .catch((err) => {
            log.error('Failed to enroll and persist user. Error: ' + (err.stack ? err.stack : err));
            return Promise.reject(err);
        });
}
module.exports.enroll = enroll;


function getCurrentContextMember(client) {
    let currentContextMember = client.getUserContext();
    if(currentContextMember){
        return currentContextMember;
    }else{
        throw new Error("현재 Client Context에 지정된 Member가 없습니다.");
    }
}
module.exports.getCurrentContextMember = getCurrentContextMember;


function getMember(client, userName) {
    log.debug('getMember() => ' + userName);

    if(!client) return Promise.reject(new Error('해당 명령을 처리할 클라이언트 멤버가 존재하지 않습니다.'))

    return client.getUserContext(userName, true)
        .then((user) => {
            return new Promise((resolve, reject) => {
                if (user && user.isEnrolled()) {
                    log.info('Successfully loaded member from persistence');
                    resolve(user);
                } else {
                    reject('Failed to get Member');
                }
            });
        })
}
module.exports.getMember = getMember;


function createMember(client, params) {

    return client.getUserContext(params.memberId, true)
        .then((user) => {
            return new Promise((resolve, reject) => {
                    if (user && user.isEnrolled()) {
                    log.info('Successfully loaded member from persistence');
                    return resolve(user);
                } else {
                    let keyPath = path.join(params.adminKeyPath);
                    let keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
                    let certPath = path.join(params.adminCertPath);
                    let certPEM = readAllFiles(certPath)[0];

                    return resolve(client.createUser({
                        username: params.memberId,
                        mspid: params.mspId,
                        cryptoContent: {
                            privateKeyPEM: keyPEM.toString(),
                            signedCertPEM: certPEM.toString()
                        }
                    }));
                }
            })
        })
        .catch((err)=>{
            return Promise.reject(new Error("Failed to create member form cert : " + err));
        })
}
module.exports.createMember = createMember;


function readAllFiles(dir) {
    let files = fs.readdirSync(dir);
    let certs = [];
    files.forEach((file_name) => {
        let file_path = path.join(dir, file_name);
        log.debug(' looking at file ::' + file_path);
        let data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}
