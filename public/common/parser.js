//channel info parser
function parseChannelInfo(chInfo){
    var channelInfo = '<height>\n' + JSON.stringify(chInfo.height) + '\n\n' +
        '<Current BlockHash>\n' + chInfo.currentBlockHash + '\n\n' +
        '<Previous BlockHash>\n' + chInfo.previousBlockHash
    return channelInfo;
}
