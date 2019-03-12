import React from 'react';
import {View, TouchableOpacity, Text, Modal, Dimensions} from 'react-native';
import { RTCPeerConnection, RTCView, mediaDevices} from 'react-native-webrtc';
import EStyleSheet from 'react-native-extended-stylesheet';

import io from 'socket.io-client';

let connected = false;
//let socket = io.connect('http://10.154.144.85:6500');
let socket = io('http://ldb-broadcasting.herokuapp.com:80')   
const configuration = {
    "iceServers": [
        {"url": "stun:stun.l.google.com:19302"}
    ]
};
let peerConnection;

const offerOptions = {'OfferToReceiveAudio':false,'OfferToReceiveVideo':false};

socket.on('connect', () => {
    console.log('client connected')
    connected = true;
	socket.emit('connected', {
        sender: 'mobile'
    })
});

socket.on('message', (message)=> {
    if (message.type === 'answer'){
		peerConnection.setRemoteDescription(message.label);
	} else if (message.type === 'candidate'){
        if (message.candidate != null){
            peerConnection.addIceCandidate(message.candidate);
        }
    }
})

socket.on('text-message', (message)=>{
    console.log('text-message', message)
    stateContainer.setState({
        modalText: message,
        modalVisible: true
    })
})

socket.on('options-message', (otherIDs, options)=> {
    console.log('options-message', options)
    stateContainer.setState({
        otherIDs: otherIDs,
        options: options,
        buttonDisabled: false
    })
})

socket.on('option-taken', (otherIDs, option) =>{
    console.log('option-taken', options)
    var newOptions = stateContainer.options
    var spliceIndex = newOptions.indexOf(option)
    newOptions.splice(spliceIndex, 1)
    stateContainer.setState({
        otherIDs: otherIDs,
        options: newOptions,
        buttonDisabled: false
    })
})

function returnOption(option){
    console.log('returning option', option)
    socket.emit('options-response', option)
}

function takeOption(otherIDs, option){
    console.log('taking-option')
    for(toID in otherIDs){
        socket.emit('option-taken', (toID, option))
    }
}

function sendMessage(message){
	socket.emit('message', 0, message)
}

function getLocalStream(isFront, callback){
    console.log('getLocalStream')

    
    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log('source infos', sourceInfos);
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
            minWidth: 1680, // Provide your own width, height and frame rate here
            minHeight: 720,
            minFrameRate: 30
          },
          facingMode: (isFront ? "user" : "environment"),
          optional: (videoSourceId ? [{sourceId: videoSourceId}] : [])
        }
      })
      .then(stream => {
        localStream = stream
        console.log(stream)
        callback(stream)
      })
      .catch(error => {
        console.log(error)
      });
    });

}

  
function sending(){
    if(connected === false){
        socket.connect()
        connected = true
    }
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.addStream(localStream)

     
    // let the "negotiationneeded" event trigger offer generation
    peerConnection.onnegotiationneeded = async () => {
        try {
            await peerConnection.setLocalDescription(await peerConnection.createOffer(offerOptions));
            // send the offer to the other peer
            sendMessage({
                sender: 'mobile',
                type: 'offer',
                label: peerConnection.localDescription
            })
        } catch (err) {
            console.error(err);
        }
    };

       // send any ice candidates to the other peer
    peerConnection.onicecandidate = ({candidate}) => {
        if (candidate != undefined){
            sendMessage({
            sender: 'mobile',
            type: 'candidate',
            candidate: candidate
       });
    }
    }
    console.log(peerConnection)
}


function stopSending(){
    sendMessage({
        sender: 'mobile', 
        type: 'bye',
    })
    socket.emit('disconnect');
    socket.close()
    connected = false;
    peerConnection.close();
    console.log('Ending call');
    
};

let stateContainer

export default class Main extends React.Component {

    constructor(props){
        super(props)

        this.onPressStart = this.onPressStart.bind(this)
        this.closeModal = this.closeModal.bind(this)
        this.onPressOption = this.onPressOption.bind(this)
    }

    // initial state
    state = {
        isConnected: false,
        selfViewSrc: null,
        stopStartText: 'Start',
        otherIDs: [],
        options: [],
        buttonDisabled: true,
        modalText: '',
        modalVisible: false
    }

  

    componentDidMount() {
        stateContainer = this;
        getLocalStream(false, (stream) => {
            localStream = stream;
            this.setState({selfViewSrc: stream.toURL()});
        });
    }

    onPressStart(){
        const { isConnected } = this.state;
        if(!isConnected){
            sending();
            this.setState({
                stopStartText: 'Stop',
                isConnected: true
            })
            styles.startButton.backgroundColor = 'red'
        } else {
            stopSending()
            this.setState({
                stopStartText: 'Start',
                isConnected: false
            })
            styles.startButton.backgroundColor = 'green'            
        }
    };


    onPressOption(option){
        returnOption(option)
        takeOption(this.state.otherIDs, option)
        this.setState({
            options: [option],
            buttonDisabled: true
        })
    }

    closeModal(){
        this.setState({
            modalVisible: false,
            modalText: ''
        })
    }


    render() {
        return (
            <View style={styles.container}>
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
                    <TouchableOpacity onPress={this.onPressStart} style={styles.startButton}>
                        <Text style={styles.buttonText}>
                            {this.state.stopStartText}
                        </Text>
                    </TouchableOpacity>
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

let deviceWidth = Dimensions.get('window').width;
EStyleSheet.build({
  $rem: 18
});
const styles = EStyleSheet.create({
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
        fontSize: '1rem'
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
    }
});
