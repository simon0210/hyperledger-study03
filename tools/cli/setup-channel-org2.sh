#!/bin/bash

echo 'Join Channel..'

CORE_PEER_ADDRESS=peer0.org2.kt.com:7051 peer channel join -b channel1.block
CORE_PEER_ADDRESS=peer1.org2.kt.com:7051 peer channel join -b channel1.block

echo 'Done'