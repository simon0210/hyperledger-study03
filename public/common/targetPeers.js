

//targetOrgs, targetPeersByOrg
//Select로 Org선택 후, type에 따라 peer 선택 (type: radio / checkbox)
function makeTargetPeersHtmlByOrg(target, clientOrgId, type){
    $.each(target, function(orgId, orgInfo){
        $('#targetOrgs select').append('<option value="'+ orgId +'" ' + (orgId==clientOrgId?'selected':'')+'> ' + orgId + ' (' + orgInfo.name + ', ' + orgInfo.mspid + ')' + '</option>');
    });

    var selectedOrgId = $("#targetOrgs option:selected").val();
    makeTargetPeers(selectedOrgId);

    $('#targetOrgs select').change(function() {
        $('#targetPeersByOrg').html("");
        var orgId = $(this).val();
        makeTargetPeers(orgId);
    });

    function makeTargetPeers(orgId){
        if(type === 'radio'){
            $.each(target[orgId]['peers'], function(peerName, peer){
                $('#targetPeersByOrg').append('<div class="radio"> <label> <input type="radio" name="' + orgId + '" value=' + peerName + '> ' + peerName + ' : ' + peer.requests + '</label> </div>');
            })
            $('#targetPeersByOrg input:radio:first').attr('checked',true);
        }else{
            $.each(target[orgId]['peers'], function(peerName, peer){
                $('#targetPeersByOrg').append('<div class="checkbox"> <label> <input type="checkbox" value=' + peerName + ' checked> ' + peerName + ' : ' + peer.requests + '</label> </div>');
            })
        }
    }
}
//makeTargetPeersHtmlByOrg의 radio 타입으로 생성된 Peer중 선택된 Peer를 가져오는 함수
function getSelectedTargetPeerByOrg(){
    var selectedTargetPeers = new Object();

    var orgId = $("#targetOrgs option:selected").val();
    var selectedPeer = $('#targetPeersByOrg input:radio:checked').val();

    selectedTargetPeers[orgId] = selectedPeer;
    return selectedTargetPeers;
}
//makeTargetPeersHtmlByOrg의 checkbox 타입으로 생성된 Peer중 선택된 Peer를 가져오는 함수
function getSelectedTargetPeersByOrg(){
    var selectedTargetPeers = new Object();

    var orgId = $("#targetOrgs option:selected").val();

    var selectedPeers = []
    $('#targetPeersByOrg input:checked').each(function(){
        selectedPeers.push($(this).val());
    })
    if(selectedPeers.length > 0) {
        selectedTargetPeers[orgId] = selectedPeers;
    }
    return selectedTargetPeers;
}



//targetPeers
//ORG와 상관 없이 checkbox로 Peer 선택 (org는 collapse로 닫힘/펼침 가능)
function makeTargetPeersHtml(target){
    $.each(target, function(orgId, orgInfo){

        $('#targetPeers').append('<button type="button" class="list-group-item" data-toggle="collapse" data-target="#' + orgId + '" data-parent="targetPeers">' +
            orgId + ' (' + orgInfo.name + ', ' + orgInfo.mspid + ')' + '<span class="badge">2<span>'
            + '</button>');

        $('#targetPeers').append($('<div/>', {
            id: orgId,
            class: 'collapse',
            'data-org': orgId
        }));

        $.each(orgInfo['peers'], function(peerName, peer){
            $('#' + orgId).append('<div class="checkbox"> <label> <input type="checkbox" value=' + peerName + ' checked> ' + peerName + ' : ' + peer.requests + '</label> </div>');
        })

        $('#' + orgId).find('input[type="checkbox"]').change(function () {
            var total = $('#' + orgId).find('input[type="checkbox"]').length
            var checked = $('#' + orgId).find('input[type="checkbox"]:checked').length;
            $('#targetPeers [data-target="#' + orgId + '"] ').find('span').text(checked + '/' + total);
        });

        var total = $('#' + orgId).find('input[type="checkbox"]').length
        let checked = $('#' + orgId).find('input[type="checkbox"]:checked').length;
        $('#targetPeers [data-target="#' + orgId + '"] ').find('span').text(checked + '/' + total);

    });
}
//makeTargetPeersHtml으로 생성된 Peer중 선택된 Peer를 가져오는 함수
function getSelectedTargetPeers(){
    var selectedTargetPeers = new Object();
    $('#targetPeers div.collapse').each(function(){
        var selectedPeers = [];
        $('#' + this.id + ' input:checked').each(function(){
            selectedPeers.push($(this).val());
        })
        if(selectedPeers.length > 0) {
            selectedTargetPeers[this.id] = selectedPeers;
        }
    })
    return selectedTargetPeers;
}

