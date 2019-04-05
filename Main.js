import React from 'react';
import {View, TouchableOpacity, Text, Modal, TextInput} from 'react-native';
import { RTCPeerConnection, RTCView, mediaDevices} from 'react-native-webrtc';
import EStyleSheet from 'react-native-extended-stylesheet';

import io from 'socket.io-client';

//let socket = io.connect('http://192.168.0.19:6500'); -> change this to local machines network address for local testing
let socket = io('http://ldb-broadcasting-server.herokuapp.com:80')   
const configuration = {
    "iceServers": [
        {
            "url": "stun:stun.l.google.com:19302"
        },
        {
            "url": "stun:stun1.l.google.com:19302"
        },
        {
            "url": "stun:stun2.l.google.com:19302"
        },
        {
            "url": "stun:stun3.l.google.com:19302"
        },
        {
            "url": "stun:stun4.l.google.com:19302"
        }
    ]
};
let peerConnection;
let stateContainer;

const offerOptions = {'OfferToReceiveAudio':false,'OfferToReceiveVideo':false};

socket.on('connect', () => {
    connected = true;
});

socket.on('message', (message)=> {
    if (message.type === 'answer'){
		peerConnection.setRemoteDescription(message.label);
	} else if (message.type === 'candidate'){
        if (message.candidate != null){
            peerConnection.addIceCandidate(message.candidate);
        }
    } 
});

socket.on('air', (message)=>{
    if (message.type === 'on-air'){
        stateContainer.setState({
            airMessage: 'Live On Air'
        })
    } else if (message.type === 'off-air'){
        stateContainer.setState({
            airMessage: 'Off Air'
        })
    }
})

socket.on('text-message', (message)=>{
    stateContainer.setState({
        modalText: message,
        modalVisible: true
    });
});

socket.on('options-message', (fromID, otherIDs, options)=> {
    if(otherIDs.length !== 0){
        var index = otherIDs.indexOf(fromID);  
        otherIDs.splice(index, 1);
    }
    stateContainer.setState({
        otherIDs: otherIDs,
        options: options,
        buttonDisabled: false
    });
});

socket.on('option-taken', (fromID, otherIDs, options) =>{
        if(otherIDs.length !== 0){
            var index = otherIDs.indexOf(fromID);  
            otherIDs.splice(index, 1);
        }
        stateContainer.setState({
            otherIDs: otherIDs,
            options: options,
            buttonDisabled: false
        });
});

socket.on('name-taken', () =>{
    stateContainer.setState({
        name: '',
        nameSet: false,
        connected: false,
        errorText: 'Name Taken'
    })
})

socket.on('mobile-connected', ()=>{
    stateContainer.setState({
        nameSet: true,
        connected: true,
        errorText: ''
    })
})

function returnOption(option){
    socket.emit('options-response', option);
};

function takeOption(otherIDs, options, option){
    var opts = [];
    for(z in options){
        if( options[z] !== option){
            opts.push(options[z]);
        }
    }
    for(x in otherIDs){
        var toID = otherIDs[x];
        var newIDs = otherIDs;
        newIDs.splice(x, 1);
        socket.emit('option-taken', toID, newIDs, opts);
    }
};

function sendMessage(message){
	socket.emit('message', 0, message);
};

function getLocalStream(isFront, callback){
    mediaDevices.enumerateDevices().then(sourceInfos => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if(sourceInfo.kind == "video" && sourceInfo.facing == (isFront ? "front" : "back")) {
          videoSourceId = sourceInfo.id;
        }
      }
      mediaDevices.getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 1680,
            minHeight: 720,
            minFrameRate: 10
          },
          facingMode: (isFront ? "user" : "environment"),
          optional: (videoSourceId ? [{sourceId: videoSourceId}] : [])
        }
      })
      .then(stream => {
        localStream = stream;
        callback(stream);
      })
      .catch(error => {
      });
    });

}

function sending(){
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.addStream(localStream);

    peerConnection.onnegotiationneeded = async () => {
        try {
            await peerConnection.setLocalDescription(await peerConnection.createOffer(offerOptions));
            sendMessage({
                sender: 'mobile',
                type: 'offer',
                label: peerConnection.localDescription
            });
        } catch (err) {
            console.error(err);
        }
    };

    peerConnection.onicecandidate = ({candidate}) => {
        if (candidate != undefined){
            sendMessage({
                sender: 'mobile',
                type: 'candidate',
                candidate: candidate
            });
        }
    }
}

function connectSocket(name){
    socket.emit('mobile-connected', {
        sender: 'mobile',
        name: name
    });
}

function stopSending(){
    sendMessage({
        sender: 'mobile', 
        type: 'bye',
    });
    stateContainer.setState({
        name: '',
        nameSet: false,
        connected: false
    })
    socket.emit('disconnect');
    socket.close();
    connected = false;
    peerConnection.close();
};

export default class Main extends React.Component {

    constructor(props){
        super(props);

        this.onPressStart = this.onPressStart.bind(this);
        this.closeModal = this.closeModal.bind(this);
        this.onPressOption = this.onPressOption.bind(this);
        this.onFilledInName = this.onFilledInName.bind(this);
    }

    state = {
        isConnected: false,
        selfViewSrc: null,
        stopStartText: 'Start Streaming',
        otherIDs: [],
        options: [],
        buttonDisabled: true,
        modalText: '',
        modalVisible: false,
        name: '',
        nameSet: false,
        connected: false,
        errorText: '',
        airMessage: 'Off Air'
    }

  

    componentDidMount() {
        stateContainer = this;
    }

    onPressStart(){
        const { isConnected } = this.state;
        if(!isConnected){
            sending();
            this.setState({
                stopStartText: 'Stop Streaming',
                isConnected: true
            });
        } else {
            stopSending()
            this.setState({
                stopStartText: 'Start Streaming',
                isConnected: false,
                options: [],
                otherIDs: [],
                airMessage: 'Off Air'
            });
        }
    };

    onFilledInName(){
        if(this.state.connected !== true){
            socket.connect();
        }
        connectSocket(this.state.name);
        getLocalStream(false, (stream) => {
            localStream = stream;
            this.setState({selfViewSrc: stream.toURL()});
        });
    }

    onPressOption(option){
        returnOption(option);
        takeOption(this.state.otherIDs, this.state.options, option);
        this.setState({
            options: [option],
            buttonDisabled: true,
        });
    }

    closeModal(){
        this.setState({
            modalVisible: false,
            modalText: ''
        });
    }


    render() {
        return (
            <View style={styles.container}>
                <View>
                    <Modal
                        animationType="none"
                        visible={!this.state.nameSet}
                        onRequestClose={null}
                    >
                    <View>
                        <View style={styles.nameModalStyle}>
                            <Text style={styles.modalText}>Enter Name:</Text>
                            <Text style={styles.errorText}>{this.state.errorText}</Text> 
                            <TextInput
                                maxLength={16}
                                style={styles.TextInput}
                                onChangeText={(name) => this.setState({name})}
                                value={this.state.name}
                            />
                            <TouchableOpacity 
                                style={styles.nameModalButton}
                                onPress={this.state.name !== '' ? this.onFilledInName : null}>
                                <Text style={styles.modalButtonText}>Enter</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    </Modal>
                </View>
                <View>
                    <Modal
                        animationType="slide"
                        visible={this.state.modalVisible}
                        transparent
                        onRequestClose={this.closeModal}
                    >
                    <View>
                        <View style={styles.modalViewStyle}>
                            <Text style={styles.modalText}>{this.state.modalText}</Text>            
                            <TouchableOpacity 
                                style={styles.modalButton}
                                onPress={this.closeModal}>
                                <Text style={styles.modalButtonText}>Okay</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    </Modal>
                </View>
                <View style={styles.videoContainer}>
                    {this.state.selfViewSrc && <RTCView streamURL={this.state.selfViewSrc}style={styles.videoPlayerContainer}/>}
                </View>
                <View style={styles.buttonContainer}>
                    <Text>{this.state.name}</Text>
                    <TouchableOpacity onPress={this.onPressStart} style={styles.startButton}>
                        <Text style={styles.buttonText}>
                            {this.state.stopStartText}
                        </Text>
                    </TouchableOpacity>
                    <Text>{this.state.airMessage}</Text>
                    { this.state.options &&
                        this.state.options.map(( option, index ) => {
                            return (
                                <TouchableOpacity key={index}  onPress={() => this.onPressOption(option)} style={styles.responseButton} disabled={this.state.buttonDisabled}>
                                    <Text style={styles.responseButtonText}>
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })
                    }   
                </View>
            </View>
        );
    }
}

EStyleSheet.build({
  $rem: 18
});
let styles = EStyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'flex-start'
    },
    videoContainer: {
        width: "75%",
        padding: 0,
        borderRightWidth: 2,
        borderColor: 'black',
        alignItems: 'center'
    },
    videoPlayerContainer: {
        height: "100%",
        width: "100%"
    },
    buttonContainer: {
        width: "25%",
        flexDirection: 'column',
        alignItems: 'center'
    },
    startButton: {
        backgroundColor: 'green',
        borderWidth: 2,
        borderColor: 'black',
        borderRadius: 5,
        marginTop: 5,
        marginBottom: 5,
        width: "90%",
    },
    responseButton: {
        backgroundColor: 'grey',
        borderWidth: 2,
        borderColor: 'black',
        borderRadius: 5,
        marginTop: 5,
        width: "90%",
        marginTop: "5%"
    },
    buttonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '0.9rem'
    },
    responseButtonText: {
        color: 'white',
        textAlign: 'center',
        fontSize: '.55rem',
        padding: "5%"
    },
    modalViewStyle:{
        borderColor: 'grey',
        borderWidth: 1,
        padding: '1rem',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '1rem',
        minWidth: "85%",
        backgroundColor: 'white'
    },
    modalButton:{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderColor: 'grey',
        width: "100%"
    },
    modalText:{
        color: 'black',
        textAlign: 'center',
        fontSize: '1rem',
        padding: "5%"
    },
    modalButtonText:{
        color: 'blue',
        textAlign: 'center',
        fontSize: '.75rem',
        paddingTop: "5%"
    },
    nameModalStyle:{
        margin: '1rem',
        backgroundColor: 'white'
    },
    nameModalButton:{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderColor: 'grey',
        width: "100%",
        bottom: 0
    },
    TextInput: {
        margin: '2rem',
        borderBottomWidth: 1
    },
    errorText:{
        textAlign: 'center',
    }
});
