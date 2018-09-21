/*
	This chaincode is for BMT.
*/

package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}

type CertInfo struct {
	Id          string `json:"id"`
	Certificate string `json:"certificate"`
	Prev_State  string `json:"prev_state"`
	State       string `json:"state"`
	Refer_Num   string `json:"refer_num"`
	Perm_Code   string `json:"perm_code"`
	Last_Modify string `json:"last_modify"`
}

const STATE_PREFIX string = "STATE_"
const REFER_NUM_PREFIX string = "REFER_NUM_"
const PERM_CODE_PREFIX string = "PERM_CODE_"
const QUERY_TYPE_CERT string = "CERTIFICATE"
const QUERY_TYPE_REFER_NUM string = "REFER_NUM"
const QUERY_TYPE_PERM_CODE string = "PERM_CODE"

const CERT_STAT_NONE = "NONE"
const CERT_STAT_ACTIVE = "ACTIVE"
const CERT_STAT_PAUSED = "PAUSED"
const CERT_STAT_EXPIRED = "EXPIRED"
const CERT_STAT_FORCE_EXPIRED = "FORCE_EXPIRED"

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	return shim.Success(nil)
}

func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("Invoke." + function)
	if function == "invoke" {
		return t.invoke(stub, args)
	} else if function == "delete" {
		return t.delete(stub, args)
	} else if function == "update" {
		return t.update(stub, args)
	} else if function == "query" {
		return t.query(stub, args)
	}

	return shim.Error("Invalid invoke function name. Expecting \"invoke\" \"delete\" \"query\"")
}

func (t *SimpleChaincode) invoke(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	fmt.Println("begin invoke")

	var id string // Entities
	var certificate string
	var prev_state string
	var state string
	var refer_num string
	var perm_code string
	var last_modify string

	if len(args) == 3 {
		id = args[0]
		certificate = args[1]
		prev_state = CERT_STAT_NONE
		state = CERT_STAT_ACTIVE
		last_modify = args[2]
	} else if len(args) == 5 {
		id = args[0]
		certificate = args[1]
		prev_state = CERT_STAT_NONE
		state = CERT_STAT_ACTIVE
		refer_num = args[2]
		perm_code = args[3]
		last_modify = args[4]
	} else {
		return shim.Error("Incorrect number of arguments. Expecting 3 or 5")
	}

	// check already exist or not
	/*certInfoJsonBytes, err := stub.GetState(id)
	if err != nil {
		return shim.Error("Failed to get the certificate info for id:" + id)
	}
	if certInfoJsonBytes != nil {
		return shim.Error("There is already same certificate info for id:" + id)
	}*/

	certInfo := &CertInfo{id, certificate, prev_state, state, refer_num, perm_code, last_modify}
	certInfoJsonBytes, err := json.Marshal(certInfo)

	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Printf("CertInfo: %s\n", *certInfo)

	// Write the state to the ledger
	err = stub.PutState(id, certInfoJsonBytes)
	if err != nil {
		fmt.Printf(err.Error())
		return shim.Error(err.Error())
	}

	return shim.Success(certInfoJsonBytes)
}

// Deletes an entity from state
func (t *SimpleChaincode) delete(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	fmt.Println("begin delete (delete is just changing state, not executing DelState.)")

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	id := args[0]
	state := args[1]
	last_modify := args[2]

	certInfoJsonBytes, err := stub.GetState(id)
	if err != nil {
		return shim.Error("Failed to get the certificate info for id:" + id)
	}
	if certInfoJsonBytes == nil {
		return shim.Error("There is no valid certificate info for id:" + id)
	}

	certInfo := CertInfo{}
	if err = json.Unmarshal(certInfoJsonBytes, &certInfo); err != nil {
		return shim.Error("Failed to Unmarshal certInfoJsonBytes")
	}

	certInfo.Prev_State = certInfo.State
	certInfo.State = state
	certInfo.Last_Modify = last_modify
	certInfoJsonBytes2, err2 := json.Marshal(certInfo)
	if err2 != nil {
		return shim.Error(err2.Error())
	}

	err2 = stub.PutState(id, certInfoJsonBytes2)
	if err2 != nil {
		return shim.Error("Failed to change certificate state of id:" + id)
	}

	return shim.Success(nil)
}

// Updates an entity from state
func (t *SimpleChaincode) update(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	fmt.Println("begin update")

	var id string // Entities
	var certificate string
	var prev_state string
	var state string
	var refer_num string
	var perm_code string
	var last_modify string

	if len(args) == 3 {
		id = args[0]
		certificate = args[1]
		prev_state = CERT_STAT_FORCE_EXPIRED
		state = CERT_STAT_ACTIVE
		last_modify = args[2]
	} else if len(args) == 5 {
		id = args[0]
		certificate = args[1]
		prev_state = CERT_STAT_FORCE_EXPIRED
		state = CERT_STAT_ACTIVE
		refer_num = args[2]
		perm_code = args[3]
		last_modify = args[4]
	} else {
		return shim.Error("Incorrect number of arguments. Expecting 3 or 5")
	}

	// check already exist or not
	certInfoJsonBytes, err := stub.GetState(id)
	if err != nil {
		return shim.Error("Failed to get the certificate info for id:" + id)
	}
	if certInfoJsonBytes == nil {
		return shim.Error("There is no valid certificate info for id:" + id)
	}

	certInfo := &CertInfo{id, certificate, prev_state, state, refer_num, perm_code, last_modify}
	certInfoJsonBytes, err = json.Marshal(certInfo)

	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Printf("CertInfo: %s\n", *certInfo)

	// Write the state to the ledger
	err = stub.PutState(id, certInfoJsonBytes)
	if err != nil {
		fmt.Printf(err.Error())
		return shim.Error(err.Error())
	}

	return shim.Success(certInfoJsonBytes)
}

// query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	fmt.Println("begin query")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	query_type := args[0]
	id := args[1]

	fmt.Println("query_type: " + query_type)
	fmt.Println("id: " + id)

	certInfoJsonBytes, err := stub.GetState(id)
	if err != nil {
		return shim.Error("Failed to get the certificate info of id:" + id)
	}
	if certInfoJsonBytes == nil {
		return shim.Error("There is no valid certificate info for id:" + id)
	}

	certInfo := CertInfo{}
	if err = json.Unmarshal(certInfoJsonBytes, &certInfo); err != nil {
		fmt.Println(err.Error())
		return shim.Error("Failed to Unmarshal certInfoJsonBytes")
	}

	if query_type == QUERY_TYPE_CERT {
		jsonResp := "{\"ID\":\"" + id + "\",\"certificate\":\"" + certInfo.Certificate + "\", \"prev_state\":\"" + string(certInfo.Prev_State) + "\", \"state\":\"" + string(certInfo.State) + "\", \"last_modify\":\"" + string(certInfo.Last_Modify) + "\"}"
		fmt.Printf("Query Response: %s\n", jsonResp)
		return shim.Success([]byte(jsonResp))
	} else if query_type == QUERY_TYPE_REFER_NUM {
		fmt.Printf("Query Response: %s\n", certInfo.Refer_Num)
		return shim.Success([]byte(certInfo.Refer_Num))
	} else if query_type == QUERY_TYPE_PERM_CODE {
		fmt.Printf("Query Response: %s\n", certInfo.Perm_Code)
		return shim.Success([]byte(certInfo.Perm_Code))
	} else {
		jsonResp := "{\"Error\":\"Invalid query type: " + query_type + "\"}"
		return shim.Error(jsonResp)
	}

}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
