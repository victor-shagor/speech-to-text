import { useEffect, useState } from "react";
import "./App.css";
import axios from "axios";
import ReactLanguageSelect from "react-languages-select";
import "react-languages-select/css/react-languages-select.css";
import { BulletList } from "react-content-loader";
import AWS from "aws-sdk";

function App() {
  const [audioURL, setAudioURL] = useState("");
  const [sourceLng, setSourceLng] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);

  const translate = new AWS.Translate({
    accessKeyId: process.env.REACT_APP_AWSACCESS,
    secretAccessKey: process.env.REACT_APP_AWSSECRET,
    region: "us-east-2",
  });
  const polly = new AWS.Polly({
    accessKeyId: process.env.REACT_APP_AWSACCESS,
    secretAccessKey: process.env.REACT_APP_AWSSECRET,
    region: "us-east-2",
  });

  const requestRecorder = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return new MediaRecorder(stream);
  };

  const uploadAudio = async (audio) => {
    const body = new FormData();
    body.append("file", audio);
    body.append("upload_preset", "j9gyxbzc");

    let config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    const { data, error } = await axios.post(
      "http://api.cloudinary.com/v1_1/djdqvlwbl/video/upload",
      body,
      config
    );
    if (data) {
      return data.url;
    } else {
      console.log(error);
    }
  };

  useEffect(() => {
    if (recorder === null) {
      if (isRecording) {
        requestRecorder().then(setRecorder);
      }
      return;
    }

    if (isRecording) {
      recorder.start();
    } else {
      recorder.stop();
    }

    const handleRecording = (e) => {
      setAudioURL(URL.createObjectURL(e.data));
      uploadAudio(e.data).then(setUploadUrl);
    };

    recorder.addEventListener("dataavailable", handleRecording);
    return () => recorder.removeEventListener("dataavailable", handleRecording);
  }, [recorder, isRecording]);

  const assembly = axios.create({
    baseURL: "https://api.assemblyai.com/v2",
    headers: {
      authorization: "0d31cadce12144789074f3f7997b5700",
      "content-type": "application/json",
    },
  });

  const getSpeechText = async (transactionId) => {
    const interval = setInterval(() => {
      assembly
        .get(`/transcript/${transactionId}`)
        .then((res) => {
          const { status } = res.data;
          if (status === "completed") {
            setText(res.data.text);
            setSourceLng(res.data.language_code);
            setIsLoading(false);
            clearInterval(interval);
          }
          if (status === "queued" || status === "processing") {
            getSpeechText(transactionId);
          }
          if (status === "error") {
            setIsLoading(false);
            clearInterval(interval);
          }
        })
        .catch((err) => {
          setIsLoading(false);
          clearInterval(interval);
        });
    }, 5000);
  };

  const speechToText = () => {
    setIsLoading(true);
    assembly
      .post("/transcript", {
        audio_url: uploadUrl,
        language_detection: true,
      })
      .then((res) => getSpeechText(res.data.id))
      .catch((err) => setIsLoading(false));
  };

  const onChangeLanguage = (languageCode) => {
    if (text && sourceLng) {
      const params = {
        SourceLanguageCode: sourceLng,
        TargetLanguageCode: languageCode,
        Text: text,
      };
      translate.translateText(params, (err, data) => {
        if (err) {
          console.log(err);
        }
        setText(data.TranslatedText);
        setSourceLng(data.TargetLanguageCode);
      });
    }
  };

  const handleDownload = () => {
    const params = {
      Text: text,
      OutputFormat: "mp3",
      VoiceId: "Joanna",
    };
    polly.synthesizeSpeech(params, (err, data) => {
      if (err) {
        console.log(err);
        return;
      }

      const a = document.createElement("a");
      document.body.appendChild(a);
      a.setAttribute("style", "display: none");

      const blob = new Blob([data.AudioStream], { type: "audio/mpeg" });
      const url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = `audio`;
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="audio">
          <audio src={audioURL} controls />
          <button onClick={speechToText} disabled={isLoading}>
            {isLoading ? "Converting...." : "Convert"}
          </button>
        </div>
        <div className="flex">
          <button disabled={isRecording} onClick={() => setIsRecording(true)}>
            Start Recording
          </button>
          <button
            disabled={!isRecording}
            onClick={() => setIsRecording(false)}
            className="danger"
          >
            Stop Recording
          </button>
        </div>
        <div className="display">
          <div>{isLoading ? <BulletList /> : text}</div>
        </div>
        <div>
          <ReactLanguageSelect
            names={"international"}
            searchable={true}
            placeholder="Change language"
            onSelect={onChangeLanguage}
          />
          <button onClick={handleDownload}>Download new audio</button>
        </div>
      </header>
    </div>
  );
}

export default App;
