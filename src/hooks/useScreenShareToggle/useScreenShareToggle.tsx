import { useState, useCallback, useRef } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import { LogLevels, Track } from 'twilio-video';

interface MediaStreamTrackPublishOptions {
  name?: string;
  priority: Track.Priority;
  logLevel: LogLevels;
}

export default function useScreenShareToggle() {
  const { room, onError } = useVideoContext();
  const [isSharing, setIsSharing] = useState(false);
  const stopScreenShareRef = useRef<() => void>(null!);
  const mediaDevices = navigator.mediaDevices as any;
  const extensionId = 'oopfkbliplhbjdhbgkffnpfjelgkfeam';

  const shareScreen = useCallback(() => {
    window.open(
      'https://www.allmysons.com',
      'targetWindow',
      'toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=no,width=375,height=667'
    );

    // navigator.mediaDevices
    //   .getDisplayMedia({
    //     audio: false,
    //     video: {
    //       frameRate: 10,
    //       height: 1080,
    //       width: 1920,
    //     },
    //   })
    new Promise((resolve, reject) => {
      const request = {
        sources: ['window'],
      };
      //Add chrome condition here
      chrome.runtime.sendMessage(extensionId, request, (response: any) => {
        if (!response) {
          alert(
            'Please install the extension:\n' +
              '1. Go to https://chrome.google.com/webstore/category/extensions\n' +
              '2. Search for: "AMS Video Screen sharing"\n' +
              '3. Click: "ADD to Chrome" Button\n' +
              '4. Reload this page'
          );
          return;
        }
        if (response && response.type === 'success') {
          resolve({ streamId: response.streamId });
        } else {
          //reject(new Error('Could not get stream'));
          console.log('Could not get stream');
        }
      });
    }).then((response: any) => {
      console.log(response.streamId);
      mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: response.streamId,
              maxFrameRate: 15,
            },
          },
        })
        .then((stream: any) => {
          const track = stream.getTracks()[0];

          // All video tracks are published with 'low' priority. This works because the video
          // track that is displayed in the 'MainParticipant' component will have it's priority
          // set to 'high' via track.setPriority()
          room.localParticipant
            .publishTrack(track, {
              name: 'screen', // Tracks can be named to easily find them later
              priority: 'low', // Priority is set to high by the subscriber when the video track is rendered
            } as MediaStreamTrackPublishOptions)
            .then(trackPublication => {
              stopScreenShareRef.current = () => {
                room.localParticipant.unpublishTrack(track);
                // TODO: remove this if the SDK is updated to emit this event
                room.localParticipant.emit('trackUnpublished', trackPublication);
                track.stop();
                setIsSharing(false);
              };

              track.onended = stopScreenShareRef.current;
              setIsSharing(true);
            })
            .catch(onError);
        })
        .catch((error: any) => {
          // Don't display an error if the user closes the screen share dialog
          if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
            onError(error);
          }
        });
    });
  }, [room, onError]);

  const toggleScreenShare = useCallback(() => {
    !isSharing ? shareScreen() : stopScreenShareRef.current();
  }, [isSharing, shareScreen, stopScreenShareRef]);

  return [isSharing, toggleScreenShare] as const;
}
