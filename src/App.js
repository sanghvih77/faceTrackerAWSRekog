import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as blazeface from '@tensorflow-models/blazeface';
import '@tensorflow/tfjs-backend-webgl';
import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1', // Your region
  accessKeyId: 'AKIAVSW2C7J3S3M2ZZYY', // Replace with your access key
  secretAccessKey: 'yjBdMH+7VFmQnd8ODp+653H8GZ5iKC4/PKhrdjn3', // Replace with your secret key
});

const rekognition = new AWS.Rekognition();

const App = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [faceData, setFaceData] = useState([]);

  useEffect(() => {
    const loadModel = async () => {
      const blazefaceModel = await blazeface.load();
      setModel(blazefaceModel);
    };
    loadModel();
  }, []);

  const detectFaces = async () => {
    if (model && webcamRef.current && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const faces = await model.estimateFaces(video, false);
      const faceData = await getFaceData(faces, video);
      setFaceData(faceData);
      drawCanvas(faceData, video);
    }
  };

  const getFaceData = async (faces, video) => {
    const faceDataPromises = faces.map(async (face, index) => {
      const { topLeft, bottomRight } = face;
      const [x1, y1] = topLeft;
      const [x2, y2] = bottomRight;

      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = x2 - x1;
      faceCanvas.height = y2 - y1;
      const faceCtx = faceCanvas.getContext('2d');
      faceCtx.drawImage(
        video,
        x1,
        y1,
        x2 - x1,
        y2 - y1,
        0,
        0,
        x2 - x1,
        y2 - y1
      );

      const faceImageData = faceCanvas.toDataURL('image/jpeg');
      const base64Data = faceImageData.split(',')[1];

      const params = {
        CollectionId: 'hs-testCollection-id', // Replace with your collection ID
        Image: {
          Bytes: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        }
      };

      try {
        const response = await rekognition.searchFacesByImage(params).promise();
        const matches = response.FaceMatches;

        if (matches.length > 0) {
          console.log(`Face ${index + 1} matched with ${matches[0].Face.ExternalImageId}`);
          return { name: matches[0].Face.ExternalImageId, topLeft, bottomRight };
        } else {
          console.log(`Face ${index + 1} is unknown`);
          return { name: 'Unknown', topLeft, bottomRight };
        }
      } catch (error) {
        console.error('Error recognizing face:', error);
        return { name: 'Error', topLeft, bottomRight };
      }
    });

    return Promise.all(faceDataPromises);
  };

  const drawCanvas = (faces, video) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach((face, index) => {
      const { name, topLeft, bottomRight } = face;
      const [x1, y1] = topLeft;
      const [x2, y2] = bottomRight;

      const width = x2 - x1;
      const height = y2 - y1;

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, width, height);
      ctx.fillStyle = 'red';
      ctx.font = '18px Arial';
      ctx.fillText(name, x1, y1 - 5);
    });
  };

  useEffect(() => {
    const interval = setInterval(detectFaces, 100);
    return () => clearInterval(interval);
  }, [model]);

  return (
    <div>
      <Webcam
        ref={webcamRef}
        style={{
          position: 'absolute',
          marginLeft: 'auto',
          marginRight: 'auto',
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 9,
          width: 640,
          height: 480,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          marginLeft: 'auto',
          marginRight: 'auto',
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 9,
          width: 640,
          height: 480,
        }}
      />
    </div>
  );
};

export default App;
