let path = require('path');
let fs = require('fs-extra');

//let log = require('fabric-client/lib/utils.js').getLogger('Member');
const log  = require('./logger.js');

// directory for file based KeyValueStore
exports.getKeyValStorePathForOrg = function(channelPath, org) {
	return path.join(channelPath, 'key', 'keyValStore' + '_' + org);
};

exports.getCryptoKeyStorePathForOrg = function(channelPath, org) {
    return path.join(channelPath, 'key', 'cryptoKeyStore' + '_' + org);
};

exports.getAdminMemberIdForOrg = function(org) {
    return org + 'Admin';
};

// temporarily set $GOPATH to the test fixture folder
exports.setGoPath = function(gopath) {
    log.info("gopath : " + gopath);
	process.env.GOPATH = path.join(gopath);
    log.info("Application GOPATH : " + process.env.GOPATH);
};

exports.getGoPath = function() {
    return path.join(process.env.GOPATH, 'src');
};

// targetPeers format => {org1 : [peer1, peer2, ...], org2 : [peer1, ...], ...}
exports.setTargets = function(allPeers, targetPeers) {
    let targets = [];
    for (let orgId in targetPeers) {
        let peerList = allPeers[orgId];
        for (let idx in targetPeers[orgId]) {
            targets.push(peerList[targetPeers[orgId][idx]][0]);
        }
    }
}

// targetPeers format => {org1 : [peer1, peer2, ...], org2 : [peer1, ...], ...}
exports.setEventhubs = function(allPeers, targetPeers, clientOrg) {
	let eventhubs = [];
    let ehPeerList = allPeers[clientOrgId];
    for (let idx in ehPeerList) {
        let eh = client.newEventHub();
        eh.setPeerAddr(ehPeerList[idx][1], ehPeerList[idx][2]);
        eh.connect();
        eventhubs.push(eh);
    }

    return eventhubs;
}



// specifically set the values to defaults because they may have been overridden when
// running in the overall test bucket ('gulp test')
exports.resetDefaults = function() {
	global.hfc.config = undefined;
	require('nconf').reset();
};

exports.cleanupDir = function(keyValStorePath) {
	let absPath = path.join(process.cwd(), keyValStorePath);

	log.info("absPath = " + absPath);
	let exists = exports.existsSync(absPath);
    log.info("exists = " + exists);

	if (exists) {
		fs.removeSync(absPath);
	}
};

exports.getUniqueVersion = function(prefix) {
	if (!prefix) prefix = 'v';
	return prefix + Date.now();
};

// utility function to check if directory or file exists
// uses entire / absolute path from root
exports.existsSync = function(absolutePath /*string*/) {
	try  {
		let stat = fs.statSync(absolutePath);
        log.info("stat = " + stat);
		if (stat.isDirectory() || stat.isFile()) {
			return true;
		} else
			return false;
	}
	catch (e) {
		return false;
	}
};
