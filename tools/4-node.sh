#!/bin/bash

docker run -itd \
    --name ca-org1 -p 7054:7054 --network="kt-blockchain-net" \
    -e FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server \
    -e FABRIC_CA_SERVER_CA_NAME=ca-org1 \
    -e FABRIC_CA_SERVER_CA_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.org1.kt.com-cert.pem \
    -e FABRIC_CA_SERVER_CA_KEYFILE=/etc/hyperledger/fabric-ca-server-config/f8ecee4e847b44e12297e4299b5cd52d05cb42018baee6e957eb4f6895a43c6e_sk \
    -e FABRIC_CA_SERVER_TLS_ENABLED=true \
    -e FABRIC_CA_SERVER_TLS_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.org1.kt.com-cert.pem \
    -e FABRIC_CA_SERVER_TLS_KEYFILE=/etc/hyperledger/fabric-ca-server-config/f8ecee4e847b44e12297e4299b5cd52d05cb42018baee6e957eb4f6895a43c6e_sk \
    -v $(pwd)/crypto-config/peerOrganizations/org1.kt.com/ca/:/etc/hyperledger/fabric-ca-server-config \
    hyperledger/fabric-ca:x86_64-1.1.0-rc1 \
    sh -c 'fabric-ca-server start -b admin:adminpw'

docker run -itd \
    --name ca-org2 -p 8054:7054 --network="kt-blockchain-net" \
    -e FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server \
    -e FABRIC_CA_SERVER_CA_NAME=ca-org2 \
    -e FABRIC_CA_SERVER_CA_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.org2.kt.com-cert.pem \
    -e FABRIC_CA_SERVER_CA_KEYFILE=/etc/hyperledger/fabric-ca-server-config/2530fe5da1d2de37ed6db914189604d823d824bdc4d5f2946e0c86b7cf0bdf31_sk \
    -e FABRIC_CA_SERVER_TLS_ENABLED=true \
    -e FABRIC_CA_SERVER_TLS_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.org2.kt.com-cert.pem \
    -e FABRIC_CA_SERVER_TLS_KEYFILE=/etc/hyperledger/fabric-ca-server-config/2530fe5da1d2de37ed6db914189604d823d824bdc4d5f2946e0c86b7cf0bdf31_sk \
    -v $(pwd)/crypto-config/peerOrganizations/org2.kt.com/ca/:/etc/hyperledger/fabric-ca-server-config \
    hyperledger/fabric-ca:x86_64-1.1.0-rc1 \
    sh -c 'fabric-ca-server start -b admin:adminpw'

docker run -itd \
    --name orderer.kt.com -p 7050:7050 -p 6065:6065 --network="kt-blockchain-net" \
    -e ORDERER_GENERAL_LOGLEVEL=debug \
    -e ORDERER_GENERAL_LISTENADDRESS=0.0.0.0 \
    -e ORDERER_GENERAL_GENESISMETHOD=file \
    -e ORDERER_GENERAL_GENESISFILE=/var/hyperledger/orderer/orderer.genesis.block \
    -e ORDERER_GENERAL_LOCALMSPID=OrdererMSP \
    -e ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp \
    -e ORDERER_GENERAL_TLS_ENABLED=true \
    -e ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key \
    -e ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt \
    -e ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt] \
    -e ORDERER_GENERAL_PROFILE_ENABLED=true \
    -e ORDERER_GENERAL_PROFILE_ADDRESS=orderer.kt.com:6065 \
    -v $(pwd)/channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block \
    -v $(pwd)/crypto-config/ordererOrganizations/kt.com/orderers/orderer.kt.com/msp:/var/hyperledger/orderer/msp \
    -v $(pwd)/crypto-config/ordererOrganizations/kt.com/orderers/orderer.kt.com/tls/:/var/hyperledger/orderer/tls \
    --workdir /opt/gopath/src/github.com/hyperledger/fabric \
    hyperledger/fabric-orderer:x86_64-1.1.0-rc1 \
    orderer

docker run -itd --link orderer.kt.com \
      --name peer0.org1.kt.com -p 7051:7051 -p 7053:7053 -p 6060:6060 --network="kt-blockchain-net"  \
      -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
      -e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=kt-blockchain-net \
      -e CORE_LOGGING_LEVEL=DEBUG \
      -e CORE_PEER_TLS_ENABLED=true \
      -e CORE_PEER_GOSSIP_USELEADERELECTION=true \
      -e CORE_PEER_GOSSIP_ORGLEADER=false \
      -e CORE_PEER_PROFILE_ENABLED=true \
      -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
      -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
      -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
      -e CORE_PEER_ID=peer0.org1.kt.com \
      -e CORE_PEER_ADDRESS=peer0.org1.kt.com:7051 \
      -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.kt.com:7051 \
      -e CORE_PEER_LOCALMSPID=Org1MSP \
      -e CORE_PEER_PROFILE_ENABLED=true \
      -e CORE_PEER_PROFILE_LISTENADDRESS=peer0.org1.kt.com:6060 \
      -v /var/run/:/host/var/run/ \
      -v $(pwd)/crypto-config/peerOrganizations/org1.kt.com/peers/peer0.org1.kt.com/msp:/etc/hyperledger/fabric/msp \
      -v $(pwd)/crypto-config/peerOrganizations/org1.kt.com/peers/peer0.org1.kt.com/tls:/etc/hyperledger/fabric/tls \
      --workdir /opt/gopath/src/github.com/hyperledger/fabric \
      hyperledger/fabric-peer:x86_64-1.1.0-rc1 \
      peer node start

docker run -itd --link orderer.kt.com --link peer0.org1.kt.com \
    --name peer1.org1.kt.com -p 8051:7051 -p 8053:7053 -p 6061:6061 --network="kt-blockchain-net"  \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=kt-blockchain-net \
    -e CORE_LOGGING_LEVEL=DEBUG \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_GOSSIP_USELEADERELECTION=true \
    -e CORE_PEER_GOSSIP_ORGLEADER=false \
    -e CORE_PEER_PROFILE_ENABLED=true \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer1.org1.kt.com \
    -e CORE_PEER_ADDRESS=peer1.org1.kt.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.kt.com:7051 \
    -e CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.kt.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org1MSP \
    -e CORE_PEER_PROFILE_ENABLED=true \
    -e CORE_PEER_PROFILE_LISTENADDRESS=peer1.org1.kt.com:6061 \
    -v /var/run/:/host/var/run/ \
    -v $(pwd)/crypto-config/peerOrganizations/org1.kt.com/peers/peer1.org1.kt.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/crypto-config/peerOrganizations/org1.kt.com/peers/peer1.org1.kt.com/tls:/etc/hyperledger/fabric/tls \
    --workdir /opt/gopath/src/github.com/hyperledger/fabric \
    hyperledger/fabric-peer:x86_64-1.1.0-rc1 \
    peer node start

docker run -itd --link orderer.kt.com \
    --name peer0.org2.kt.com -p 9051:7051 -p 9053:7053 -p 6062:6062 --network="kt-blockchain-net"  \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=kt-blockchain-net \
    -e CORE_LOGGING_LEVEL=DEBUG \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_GOSSIP_USELEADERELECTION=true \
    -e CORE_PEER_GOSSIP_ORGLEADER=false \
    -e CORE_PEER_PROFILE_ENABLED=true \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer0.org2.kt.com \
    -e CORE_PEER_ADDRESS=peer0.org2.kt.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.kt.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_PROFILE_ENABLED=true \
    -e CORE_PEER_PROFILE_LISTENADDRESS=peer0.org2.kt.com:6062 \
    -v /var/run/:/host/var/run/ \
    -v $(pwd)/crypto-config/peerOrganizations/org2.kt.com/peers/peer0.org2.kt.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/crypto-config/peerOrganizations/org2.kt.com/peers/peer0.org2.kt.com/tls:/etc/hyperledger/fabric/tls \
    --workdir /opt/gopath/src/github.com/hyperledger/fabric \
    hyperledger/fabric-peer:x86_64-1.1.0-rc1 \
    peer node start

docker run -itd --link orderer.kt.com --link peer0.org2.kt.com \
    --name peer1.org2.kt.com -p 10051:7051 -p 10053:7053 -p 6063:6063 --network="kt-blockchain-net"  \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=kt-blockchain-net \
    -e CORE_LOGGING_LEVEL=DEBUG \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_GOSSIP_USELEADERELECTION=true \
    -e CORE_PEER_GOSSIP_ORGLEADER=false \
    -e CORE_PEER_PROFILE_ENABLED=true \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer1.org2.kt.com \
    -e CORE_PEER_ADDRESS=peer1.org2.kt.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.kt.com:7051 \
    -e CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.kt.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_PROFILE_ENABLED=true \
    -e CORE_PEER_PROFILE_LISTENADDRESS=peer1.org2.kt.com:6063 \
    -v /var/run/:/host/var/run/ \
    -v $(pwd)/crypto-config/peerOrganizations/org2.kt.com/peers/peer1.org2.kt.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/crypto-config/peerOrganizations/org2.kt.com/peers/peer1.org2.kt.com/tls:/etc/hyperledger/fabric/tls \
    --workdir /opt/gopath/src/github.com/hyperledger/fabric \
    hyperledger/fabric-peer:x86_64-1.1.0-rc1 \
    peer node start

docker run -itd \
    --network="kt-blockchain-net" \
    --name org1-cli \
    -e GOPATH=/opt/gopath \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e CORE_LOGGING_LEVEL=DEBUG \
    -e CORE_PEER_ID=cli \
    -e CORE_PEER_ADDRESS=peer0.org1.kt.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org1MSP \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.kt.com/peers/peer0.org1.kt.com/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.kt.com/peers/peer0.org1.kt.com/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.kt.com/peers/peer0.org1.kt.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.kt.com/users/Admin@org1.kt.com/msp \
    -v /var/run/:/host/var/run/ \
    -v $(pwd)/chaincode:/opt/gopath/src/github.com/hyperledger/fabric/examples/chaincode/go \
    -v $(pwd)/crypto-config:/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ \
    -v $(pwd)/channel-artifacts:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts \
    -v $(pwd):/opt/gopath/src/github.com/hyperledger/fabric/peer \
    --workdir /opt/gopath/src/github.com/hyperledger/fabric/peer \
    hyperledger/fabric-tools:x86_64-1.1.0-rc1  \


docker run -itd \
    --network="kt-blockchain-net" \
    --name org2-cli \
    -e GOPATH=/opt/gopath \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e CORE_LOGGING_LEVEL=DEBUG \
    -e CORE_PEER_ID=cli \
    -e CORE_PEER_ADDRESS=peer0.org2.kt.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.kt.com/peers/peer0.org2.kt.com/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.kt.com/peers/peer0.org2.kt.com/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.kt.com/peers/peer0.org2.kt.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.kt.com/users/Admin@org2.kt.com/msp \
    -v /var/run/:/host/var/run/ \
    -v $(pwd)/chaincode:/opt/gopath/src/github.com/hyperledger/fabric/examples/chaincode/go \
    -v $(pwd)/crypto-config:/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ \
    -v $(pwd)/channel-artifacts:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts \
    -v $(pwd):/opt/gopath/src/github.com/hyperledger/fabric/peer \
    --workdir /opt/gopath/src/github.com/hyperledger/fabric/peer \
    hyperledger/fabric-tools:x86_64-1.1.0-rc1  \
