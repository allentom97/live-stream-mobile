import React from 'react';
import {View, TouchableOpacity, Text,} from 'react-native';
import { RTCPeerConnection, RTCView, mediaDevices} from 'react-native-webrtc';
import EStyleSheet from 'react-native-extended-stylesheet';

import io from 'socket.io-client';

let connected = false;
let socket = io.connect('http://10.154.144.85:6500');
//let socket = io('https://ldb-broadcasting.herokuapp.com:19276')
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
    // initial state
    state = {
        isConnected: false,
        isFront: false,
        selfViewSrc: null,
        remotePeer: null,
        stopStartText: 'Start',
        buttonOneDisabled: true,
        buttonTwoDisabled: true,
        buttonThreeDisabled: true,
    }


    componentDidMount() {
        console.log('componentDidmount')
        stateContainer = this;
        const { isFront } = this.state;
        getLocalStream(isFront, (stream) => {
            localStream = stream;
            console.log('compDidMount-stream', stream.toURL())
            stateContainer.setState({selfViewSrc: stream.toURL()});
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




    render() {
        return (
            <View style={styles.container}>
                <View style={styles.videoContainer}>
                    {this.state.selfViewSrc && <RTCView streamURL={this.state.selfViewSrc}style={styles.videoPlayerContainer}/>}
                </View>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity onPress={this.onPressStart.bind(this)} style={styles.startButton}>
                        <Text style={styles.buttonText}>
                            {this.state.stopStartText}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity  style={styles.responseButton} disabled={this.state.buttonOneDisabled}>
                        <Text style={styles.responseButtonText}>
                            lorem ipsum et delorum 
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity  style={styles.responseButton} disabled={this.state.buttonTwoDisabled}>
                        <Text style={styles.responseButtonText}>
                        lorem ipsum et delorum 
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity  style={styles.responseButton} disabled={this.state.buttonThreeDisabled}>
                        <Text style={styles.responseButtonText}>
                        lorem ipsum et delorum 
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }
}

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
    }
});
