// Compressor.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FiUpload,
  FiLoader,
  FiLock,
  FiFileText,
  FiZap,
  FiSmile,
  FiX,
} from "react-icons/fi";

const Compressor = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [compressionRatio, setCompressionRatio] = useState(50); // Default compression ratio
  const [videoCodec, setVideoCodec] = useState("H264"); // Default codec
  const [video_size, setVideo_size] = useState();
  const [video_unit, setVideo_unit] = useState();
  const [compressing_message, setCompressing_message] = useState("");
  const [fakeCounter, setFakeCounter] = useState(1);
  const [fileSize, setFileSize] = useState(null);
  const [videoOutputFormat, setVideoOutputFormat] = useState("mp4");
  const [isLogin, setIsLogin] = useState(false)

  localStorage.setItem("com_counter", 1);

  const features = [
    {
      name: "Complete Privacy",
      description:
        "We know that file security and privacy are important to you. That is why we use SSL encryption when transferring files and automatically delete them after a few hours.",
      icon: FiLock,
    },
    {
      name: "Works with Any Format",
      description:
        "Our tools supports all known video formats, from popular MP4 to rare 3GP. No more worries about player compatibility.",
      icon: FiFileText,
    },
    {
      name: "Lightning Fast Processing",
      description:
        "Our cutting-edge servers ensure that your videos are processed and ready in no time, with no waiting in queues.",
      icon: FiZap,
    },
    {
      name: "User-Friendly Interface",
      description:
        "Navigate our platform with ease, thanks to an intuitive design that makes video editing accessible to everyone.",
      icon: FiSmile,
    },
  ];

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const sizeinmb = file.size / 1024 / 1024;
    console.log(sizeinmb);

    if (
      (sessionStorage.getItem("isSignedIn") && sizeinmb <= 100) ||
      sizeinmb <= 50
    ) {
      setSelectedFile(file);
      setFileSize(file.size);
      setDownloadUrl(null);
    } else if (sessionStorage.getItem("isSignedIn")) {
      alert(
        "Please upgrade your plan to compress video with size greater than 100MB"
      );
    } else {
      console.log("3");
      alert("Please Sign Up to compress video with size greater than 50MB");
    }
  };

  const poll_for_final_video = async (file_key) => {
    let status = 0;
    while (status !== 3) {
      const res = await axios.get(
        `http://localhost:4000/api/v1/status?video_id=${file_key}`
      );
      status = res.data.status;
      if (status === 3) {
        setDownloadUrl(res.data.url);
        console.log(res.data.url);
        setIsCompressing(false);
        setVideo_size(res.data.size);
        setVideo_unit(res.data.unit);
        console.log(res.data.size, res.data.unit);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  };

  const fakeMsg = {
    1: "Uploading 45%",
    2: "Uploading 91%",
    3: "Compressing 12%",
    4: "Compressing 45%",
    5: "Compressing 78%",
    6: "Compressing 98%",
    7: "Compressing 100%",
    8: "Exporting...",
  };
  const [progress, setProgress] = useState(0);
  const handleChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 0 && value <= 100) {
      setProgress(value);
    }
  };
  const handleoutputvideoformat = (e) => {
    setVideoOutputFormat(e.target.value);
  };

  useEffect(() => {
    if (isCompressing) {
      let counter = 1;
      const interval = setInterval(() => {
        if (counter <= Object.keys(fakeMsg).length) {
          setCompressing_message(fakeMsg[counter]);
          var number = 100;
          var number_array = fakeMsg[counter].match(/\d+/);
          if (number_array) number = parseInt(number_array[0]);
          setProgress(number);
          counter++;
        } else {
          clearInterval(interval);
        }
      }, 2750);

      return () => clearInterval(interval); // Clear interval on unmount or when isCompressing changes
    }
  }, [isCompressing]);

  useEffect(() => {
    const updateLoginStatus = () => {
      setIsLogin(sessionStorage.getItem('isSignedIn'));
    };
  
    window.addEventListener('loginStatusChanged', updateLoginStatus);
    updateLoginStatus();
    return () => {
      window.removeEventListener('loginStatusChanged', updateLoginStatus);
    };
  }, []);

  const handleCompress = async () => {
    if (!selectedFile) return;
    const sizeinmb = selectedFile.size / 1024 / 1024;
    if (
      (sessionStorage.getItem("isSignedIn") && sizeinmb <= 100) ||
      sizeinmb <= 50
    ) {
      setIsCompressing(true);

      // try {
      //   const result = await axios.post(
      //     "http://localhost:4000/api/v1/video/upload",
      //     { service: 1, number_of_chunks: 100 }
      //   );
      //   var presigned_urls = result.data;
      //   let parts = [];
      //   const uploadPromises = [];
      //   const temp = []
      //   const chunk_size = fileSize / 100;
      //   for (let i = 0; i < 100; i++) {
      //     let start = i * chunk_size;
      //     let end = Math.min(start + chunk_size, fileSize);
      //     let chunk = selectedFile.slice(start, end);
      //     let presignedUrl = presigned_urls[i];
      //     console.log("tushar", selectedFile.type)
      //     uploadPromises.push(
      //       axios.put(presignedUrl, chunk, {
      //         headers: {
      //           "Content-Type": 'video/mp4',
      //         },
      //       })
      //     );
      //     temp.push({presignedUrl, chunk})
      //   }
      //   console.log(temp);

      //   const uploadResponses = await Promise.all(uploadPromises);

      //   uploadResponses.forEach((response, i) => {
      //     // existing response handling

      //     parts.push({
      //       etag: response.headers.etag,
      //       PartNumber: i + 1,
      //     });
      //   });

      //   console.log("Parts- ", parts);
      // } catch (err) {
      //   console.log(err);
      // }
      
      
      const formData = new FormData();
      formData.append("service", 1);
      formData.append("file", selectedFile);
      formData.append("output_video_format", videoOutputFormat);
      formData.append("compression_ratio", compressionRatio);

      try {
        const result = await axios.post(
          "http://localhost:4000/api/v1/video/upload",
          formData,
          { withCredentials: true }
        );
        await poll_for_final_video(result.data.file_unique_key);
      } catch (error) {
        console.error("Error during compression:", error);
        setIsCompressing(false);
      }
    } else if (sessionStorage.getItem("isSignedIn")) {
      alert(
        "Please upgrade your plan to compress video with size greater than 100MB"
      );
    } else {
      alert("Please Sign Up to compress video with size greater than 50MB");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-white px-4 py-16 ubuntu-light">
      <div className="max-w-3xl text-center mb-12">
        <h1 className="text-6xl font-bold text-gray-800 mb-4">
          Compress Video
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Reduce the file size of your videos
        </p>
        {!selectedFile ? (
          <>
            <label
              htmlFor="video-upload"
              className="bg-[#2e92ff] text-white text-lg font-bold py-4 px-8 rounded-lg shadow-lg cursor-pointer hover:bg-[#1c6eff] focus:outline-none focus:ring-2 focus:ring-[#2e92ff] flex items-center justify-center"
            >
              <FiUpload className="w-6 h-6 mr-2" />
              Choose File
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {!isLogin ? (
              <>
                <p className="text-sm text-gray-600 mt-3">
                  Max file size 50MB.{" "}
                  <span className="underline text-[#2e92ff] cursor-pointer">
                    Sign Up
                  </span>{" "}
                  for more.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mt-3">
                  Max file size 100MB.
                </p>
              </>
            )}
          </>
        ) : (
          <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg shadow-md p-6">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <FiFileText className="text-gray-500 mr-2" size={20} />
                <span className="text-gray-700">
                  <strong>{selectedFile.name}</strong>
                </span>
              </div>
              <FiX className="text-gray-500 cursor-pointer" size={20} />
            </div>

            {/* Size Info */}
            <div className="flex justify-between items-center text-gray-600 mb-4">
              <span className="fond-bold">
                Original size:{" "}
                <strong>
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </strong>
              </span>
              {!downloadUrl ? (
                <div className="flex items-center">
                  <label htmlFor="output-format" className="mr-2 text-gray-700">
                    Output format:
                  </label>
                  <select
                    id="output-format"
                    className="px-1 py-1 border border-gray-300 text-[#2e92ff] rounded-md shadow-sm focus:outline-none focus:ring-2"
                    onClick={handleoutputvideoformat}
                  >
                    <option value="mp4">MP4</option>
                    <option value="mov">MOV</option>
                    <option value="mkv">MKV</option>
                    <option value="avi">AVI</option>
                  </select>
                </div>
              ) : (
                <div>
                  <span className="font-light mt-1">
                    Compressed size:{"  "}
                    <strong>696 KB</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Compression Options */}

            {downloadUrl ? (
              <>
                <p className="mt-1 text-green-400 font-semibold border border-green-400 w-30">
                  Saved 95%🥳
                </p>
                <a
                  href={downloadUrl}
                  download
                  className="bg-[#2e92ff] text-white text-lg font-bold mx-40 mt-5 py-4 px-8 rounded-lg shadow-lg mt-4 hover:bg-[#1c6eff] flex items-center justify-center"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
              </>
            ) : (
              <>
                {/* <p className="mt-1 text-green-400 font-semibold">
                  {compressing_message}
                </p> */}
                {isCompressing && (
                  <div className="flex flex-col items-center">
                    <p className="mt-2 text-green-400">{compressing_message}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-400 h-2 rounded-full"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCompress}
                  disabled={isCompressing}
                  className={`bg-[#2e92ff] text-white text-lg font-bold mx-40 mt-5 py-4 px-8 rounded-lg shadow-lg mt-4 ${
                    isCompressing
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-[#1c6eff]"
                  } flex items-center justify-center`}
                >
                  {isCompressing ? (
                    <>
                      Compressing
                      <FiLoader className="ml-2 w-5 h-5 animate-spin" />
                    </>
                  ) : (
                    "Compress Now"
                  )}
                </button>
                <div className="mt-6 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-4">
                    Additional settings (optional)
                  </h3>
                  <div className="mb-4">
                    <label className="block text-lg font-medium text-gray-700">
                      Select target size (%)
                    </label>
                    <div className="relative w-full">
                      <input
                        type="number"
                        value={compressionRatio}
                        onChange={(e) => setCompressionRatio(e.target.value)}
                        onInput={(e) => {
                          const value = Math.max(
                            0,
                            Math.min(100, e.target.value)
                          ); // Restrict the value between 1 and 100
                          setCompressionRatio(value);
                          e.target.value = value; // Update the input field with the restricted value
                        }}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2e92ff] border-[#2e92ff] appearance-none -moz-appearance-none -webkit-appearance-none"
                        min={0}
                        max={100}
                      />

                      <span className="absolute inset-y-0 right-3 flex items-center text-gray-500">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-lg font-medium text-gray-700">
                      Video Codec
                    </label>
                    <select
                      value={videoCodec}
                      onChange={(e) => setVideoCodec(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2e92ff] border-[#2e92ff]"
                    >
                      <option value="H264">H264</option>
                      <option value="H265">H265</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* fsadfasf */}

      <div className="bg-white py-24 sm:py-32 text-4xl ubuntu-light">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-[#2e92ff]">
              Optimize Your Videos
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              All the tools you need to enhance your videos
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Seamlessly compress, resize, convert, and edit your videos with
              our easy-to-use tools. Get the best out of your video content
              without compromising quality.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              {features.map((feature) => (
                <div key={feature.name} className="relative pl-16 text-xl">
                  <dt className="font-semibold leading-7 text-gray-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2e92ff]">
                      <feature.icon
                        aria-hidden="true"
                        className="h-6 w-6 text-white"
                      />
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-2 leading-8 text-gray-600 text-lg">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* fasdfas */}
    </div>
  );
};

export default Compressor;
