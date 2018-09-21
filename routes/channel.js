'use strict';

const log  = require('../utils/logger.js');
const bcClient = require('../blockchain/bcClient');
const config = require('../configuration/config.json');

exports.openPage = function(req, res) {
    res.render('channel');
}

exports.openAdminPage = function(req, res) {
    res.render('channel_admin');
}

exports.createChannel = function(req, res) {
	return bcClient.createChannel()
		.then((chain) => {
			log.info("CreateChannel 성공: " + JSON.stringify(chain));
			res.status(200).send({ msg : chain });
		})
		.catch((err) => {
			log.error('CreateChannel 실패 - ' + (err.message ? err.message : err));
			res.status(500).send({ error :  (err.message ? err.message : err) });
		});
};


exports.joinChannel = function(req, res) {
    let targetPeers = JSON.parse(req.body['targetPeers']);

    return bcClient.joinChannel(targetPeers)
        .then((chain) => {
            log.info("JoinChannel 성공: " + chain);
            res.status(200).send({ msg : chain });
        })
		.catch((err) => {
            log.error('JoinChannel 실패 - ' + err);
            res.status(500).send({ error : (err.message ? err.message : err )});
        });
};

exports.queryChannels = function(req, res) {
    let targetPeers = JSON.parse(req.body['targetPeers']);

    log.info("targetPeers : " + targetPeers);
    return bcClient.queryChannels(targetPeers)
        .then((channels) => {
            log.info("JoinChannel 성공: " + channels);
            res.status(200).send({ msg : channels });
        })
        .catch((err) => {
            log.error('JoinChannel 실패 - ' + err);
            res.status(500).send({ error : (err.message ? err.message : err )});
        });
};

exports.queryChannelInfo = function (req, res) {
    let targetPeers = JSON.parse(req.body['targetPeers']);

    bcClient.queryChannelInfo(targetPeers)
        .then((info) => {
            log.info('channel height low: ' + JSON.stringify(info.height.low));
            log.info('channel height high: ' + JSON.stringify(info.height.high));
            log.info('channel height unsigned: ' + JSON.stringify(info.height.unsigned));

            let currentBlockHash = (new Buffer(info.currentBlockHash.buffer)).toString("Hex", info.currentBlockHash.offset, info.currentBlockHash.limit);
            let previousBlockHash = (new Buffer(info.previousBlockHash.buffer)).toString("Hex", info.previousBlockHash.offset, info.previousBlockHash.limit);
            log.info('currentBlockHash : ' + currentBlockHash);
            log.info('previousBlockHash : ' + previousBlockHash);
            let channelInfo = {
                'height': info.height,
                'currentBlockHash': currentBlockHash,
                'previousBlockHash': previousBlockHash
            };
            res.status(200).send({msg: channelInfo});
        })
        .catch(function (err) {
            log.error('queryChannelInfo - ' + err);
            res.status(500).send({error: (err.message ? err.message : err)});
        });
}

exports.getChannelPeers = function(req, res) {

    let channelPeers = bcClient.getChannelPeers();
    let clientOrgId = bcClient.getClientOrgId();

    if(channelPeers){
        res.status(200).send({ channelPeers : channelPeers, clientOrgId : clientOrgId });
    }else{
        res.status(500).send({ error : 'error'});
    }
};
