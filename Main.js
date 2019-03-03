import React from 'react';
import {View, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
    MediaStream,
    MediaStreamTrack,
    mediaDevices
  } from 'react-native-webrtc';
import EStyleSheet from 'react-native-extended-stylesheet';

import io from 'socket.io-client';

const socket = io.connect('10.154.145.96:6500');

socket.on('connect', () => {
  console.log('client connected')
  socket.emit('offer', 'mobile hello')
});

socket.on('offer', (data) => {
// Set remote description and send the answer
});

socket.on('answer', (data) => {
// Set remote description
});

socket.on('candidate', (data) => {
// Add ICE candidate to RTCPeerConnection
});

const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
const pcPeers = {};
let localStream;

getLocalStream = (isFront, callback) => {
    console.log('getLocalStream')

    mediaDevices.enumerateDevices().then(sourceInfos => {
        console.log(sourceInfos);
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
                minWidth: 640,
                minHeight: 360,
                minFrameRate: 10,
            },
            facingMode: (isFront ? "user" : "environment"),
            optional: (videoSourceId ? [{sourceId: videoSourceId}] : [])
          }
        })
        .then(stream => {
            console.log('Streaming OK', stream);
            callback(stream)
        })
        .catch(error => {
            console.log('Streaming OK', stream);
            callback(stream)
        });
      });
}




// createPC = (socketId, isOffer) => {
//     const pc = new RTCPeerConnection(configuration);
//     pcPeers[socketId] = pc;
  
//     pc.onicecandidate =  (event) => {
//       console.log('onicecandidate', event.candidate);
//       if (event.candidate) {
//         socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
//       }
//     };
  
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

// exchange = (data) => {
//     const fromId = data.from;
//     let pc;
//     if (fromId in pcPeers) {
//       pc = pcPeers[fromId];
//     } else {
//       pc = createPC(fromId, false);
//     }
  
//     if (data.sdp) {
//       console.log('exchange sdp', data);
//       pc.setRemoteDescription(new RTCSessionDescription(data.sdp),  () => {
//         if (pc.remoteDescription.type == "offer")
//           pc.createAnswer((desc) => {
//             console.log('createAnswer', desc);
//             pc.setLocalDescription(desc,  () => {
//               console.log('setLocalDescription', pc.localDescription);
//               socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
//             }, logError);
//           }, logError);
//       }, logError);
//     } else {
//       console.log('exchange candidate', data);
//       pc.addIceCandidate(new RTCIceCandidate(data.candidate));
//     }
// }

// socket.on('connect', (data) => {
//   console.log('connect');
//   getLocalStream(true, (stream) => {
//     localStream = stream;
//     console.log('socket connect', stream.toURL())
//     stateContainer.setState({selfViewSrc: stream.toURL()});
//     stateContainer.setState({status: 'ready', info: 'Please enter or create room ID'});
//   });
// });

let stateContainer

export default class Main extends React.Component {
    // initial state
    state = {
        info: 'Initializing',
        status: 'init',
        roomID: '',
        isFront: true,
        selfViewSrc: null,
        remoteList: {},
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
            if (localStream) {
              for (const id in pcPeers) {
                const pc = pcPeers[id];
                pc && pc.removeStream(localStream);
              }
              localStream.release();
            }
            localStream = stream;
            container.setState({selfViewSrc: stream.toURL()});
            console.log(this.state.selfViewSrc)
            for (const id in pcPeers) {
              const pc = pcPeers[id];
              pc && pc.addStream(localStream);
            }
          });
    }

    onPressStart(){
        const { isStreaming } = this.state;
        if(!isStreaming){
            this.setState({
                stopStartText: 'Stop',
                isStreaming: true
            })
            styles.startButton.backgroundColor = 'red'
        } else {
            this.setState({
                stopStartText: 'Start',
                isStreaming: false
            })
            styles.startButton.backgroundColor = 'green'
        }
    };


    render() {
        return (
            <View style={styles.container}>
                <View style={styles.videoContainer}>
                    <RTCView streamURL={this.state.selfViewSrc}style={styles.videoPlayerContainer}/>
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
        borderColor: 'black'
    },
    videoPlayerContainer: {
        marginLeft: "2.55%",
        height: "100%",
        aspectRatio: 5/4 ,
        backgroundColor: 'white'
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
