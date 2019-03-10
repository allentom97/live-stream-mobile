import React from 'react';
import {View, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView,MediaStream,MediaStreamTrack, mediaDevices} from 'react-native-webrtc';
import EStyleSheet, { create } from 'react-native-extended-stylesheet';

import io from 'socket.io-client';

const socket = io.connect('http://10.154.144.85:6500');
const configuration = {
    "iceServers": [
        {"url": "stun:stun.l.google.com:19302"}
    ]
};
let pc;

const offerOptions = {'OfferToReceiveAudio':false,'OfferToReceiveVideo':false};
socket.on('connect', () => {
	console.log('client connected')
	sendMessage({
		sender: 'mobile', 
		type: 'connected'
    })
});

socket.on('message-for-mobile', (message)=> {
	if (message.type === 'offer'){
        // mobile only one to send offer
	} else if (message.type === 'answer'){
		pc.setRemoteDescription(message.label);
	} else if (message.type === 'candidate'){
        if (message.candidate != null){
            pc.addIceCandidate(message.candidate);
        }
    }
})

setInterval(() => {
	console.log(pc)
}, 10000)

function sendMessage(message){
	socket.emit('message', message)
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
            minWidth: 1920, // Provide your own width, height and frame rate here
            minHeight: 1080,
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
  
//      createOffer = () => {
//       pc.createOffer((desc) => {
//         console.log('createOffer', desc);
//         pc.setLocalDescription(desc,  () => {
//           console.log('setLocalDescription', pc.localDescription);
//           socket.emit('exchange', {'to': socketId, 'sdp': pc.localDescription });
//         }, logError);
//       }, logError);
//     }
  
//     pc.onnegotiationneeded =  () => {
//       console.log('onnegotiationneeded');
//       if (isOffer) {
//         createOffer();
//       }
//     }
  
//     pc.oniceconnectionstatechange = (event) => {
//       console.log('oniceconnectionstatechange', event.target.iceConnectionState);
//       if (event.target.iceConnectionState === 'completed') {
//         setTimeout(() => {
//           getStats();
//         }, 1000);
//       }
//       if (event.target.iceConnectionState === 'connected') {
//         createDataChannel();
//       }
//     };
//     pc.onsignalingstatechange = (event) => {
//       console.log('onsignalingstatechange', event.target.signalingState);
//     };
  
//     pc.onaddstream =  (event) => {
//       console.log('onaddstream', event.stream);
//       stateContainer.setState({info: 'One peer join!'});
  
//       const remoteList = stateContainer.state.remoteList;
//       remoteList[socketId] = event.stream.toURL();
//       stateContainer.setState({ remoteList: remoteList });
//     };
//     pc.onremovestream =  (event) => {
//       console.log('onremovestream', event.stream);
//     };
  
//     pc.addStream(localStream);
//     createDataChannel = () => {
//       if (pc.textDataChannel) {
//         return;
//       }
//       const dataChannel = pc.createDataChannel("text");
  
//       dataChannel.onerror =  (error) => {
//         console.log("dataChannel.onerror", error);
//       };
  
//       dataChannel.onmessage =  (event) => {
//         console.log("dataChannel.onmessage:", event.data);
//         stateContainer.receiveTextData({user: socketId, message: event.data});
//       };
  
//       dataChannel.onopen =  () => {
//         console.log('dataChannel.onopen');
//         stateContainer.setState({textRoomConnected: true});
//       };
  
//       dataChannel.onclose =  () => {
//         console.log("dataChannel.onclose");
//       };
  
//       pc.textDataChannel = dataChannel;
//     }
//     return pc;
//   }




function send(){
    pc = new RTCPeerConnection(configuration);
    pc.addStream(localStream)

     
    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = async () => {
        try {
            await pc.setLocalDescription(await pc.createOffer(offerOptions));
            // send the offer to the other peer
            sendMessage({
                sender: 'mobile',
                type: 'offer',
                label: pc.localDescription
            })
        } catch (err) {
            console.error(err);
        }
    };

       // send any ice candidates to the other peer
    pc.onicecandidate = ({candidate}) => {
        if (candidate != undefined){
            sendMessage({
            sender: 'mobile',
            type: 'candidate',
            candidate: candidate
       });
    }
    }
    console.log(pc)
}


function stop(){
    pc.close();
    console.log('Ending call');
    sendMessage({
            sender: 'mobile', 
            type: 'bye',
    })
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
            send();
            this.setState({
                stopStartText: 'Stop',
                isConnected: true
            })
            styles.startButton.backgroundColor = 'red'
        } else {
            stop()
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

const {height, width} = Dimensions.get('window');
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
        aspectRatio: 5/4
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
