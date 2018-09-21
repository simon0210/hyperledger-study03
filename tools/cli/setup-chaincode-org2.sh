#!/bin/bash

echo 'Install ChainCode'

CORE_PEER_ADDRESS=peer0.org2.kt.com:7051 peer chaincode install -n Certificate -v 1.1 -p github.com/hyperledger/fabric/examples/chaincode/go/certificate_cc
CORE_PEER_ADDRESS=peer1.org2.kt.com:7051 peer chaincode install -n Certificate -v 1.1 -p github.com/hyperledger/fabric/examples/chaincode/go/certificate_cc

echo 'Done'