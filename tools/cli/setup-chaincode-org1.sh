#!/bin/bash

echo 'Install ChainCode'

CORE_PEER_ADDRESS=peer0.org1.kt.com:7051 peer chaincode install -n Certificate -v 1.1 -p github.com/hyperledger/fabric/examples/chaincode/go/certificate_cc
CORE_PEER_ADDRESS=peer1.org1.kt.com:7051 peer chaincode install -n Certificate -v 1.1 -p github.com/hyperledger/fabric/examples/chaincode/go/certificate_cc

echo 'Done'

echo 'Instantiate ChainCode'

CORE_PEER_ADDRESS=peer0.org1.kt.com:7051 peer chaincode instantiate -o orderer.kt.com:7050 --tls $CORE_PEER_TLS_ENABLED \
--cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/kt.com/orderers/orderer.kt.com/msp/tlscacerts/tlsca.kt.com-cert.pem \
-C channel1 -n Certificate -v 1.1 -c '{"Args":["init","a","100","b","200"]}' -P "OR   ('Org1MSP.member','Org2MSP.member')"

echo 'Done'