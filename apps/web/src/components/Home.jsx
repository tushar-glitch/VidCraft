import React, { useState } from "react";
import { FiSearch } from "react-icons/fi";
import Card from "./Card";
import { useNavigate } from "react-router-dom";
import {
  FiUpload,
  FiLoader,
  FiLock,
  FiFileText,
  FiZap,
  FiSmile,
  FiVideo
} from "react-icons/fi";

import CompressImg from "../assets/compress.png"
import ResizeImg from "../assets/resize.png"
import AddWatermark from "../assets/add-watermark.png"
import FormatConv from "../assets/format-conversion.png"
import Trim from "../assets/trim.png"
import Merge from "../assets/merge.png"

const sampleImage = "https://via.placeholder.com/150";

const Home = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

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

  const handleCardClick = (path) => {
    navigate(path);
  };

  const cardsData = [
    {
      name: "Video Compression",
      description: "Reduce the file size of your videos.",
      image: CompressImg,
      path: "/compress",
    },
    {
      name: "Video Resize",
      description: "Change the dimensions of your videos.",
      image: ResizeImg,
      path: "/resize",
    },
    {
      name: "Format Conversion",
      description: "Convert your videos to different formats.",
      image: FormatConv,
      path: "/convert",
    },
    {
      name: "Add Watermark",
      description: "Add a custom watermark to your videos.",
      image: AddWatermark,
      path: "/add-watermark",
    },
    {
      name: "Trim Video",
      description: "Cut and trim your videos easily.",
      image: Trim,
      path: "/trim",
    },
    {
      name: "Merge Videos",
      description: "Combine multiple videos into one.",
      image: Merge,
      path: "/merge",
    },
  ];

  const filteredCards = cardsData.filter((card) =>
    card.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col items-center min-h-screen bg-white px-4 py-16 ubuntu-light">
      <div className="max-w-3xl text-center mb-12">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Transform Your Videos with Ease
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          Unlock the full potential of your videos with our all-in-one online
          editor. Fast, free, and effortless editing at your fingertips! No
          signup needed.
        </p>
        <div className="relative w-full max-w-md mx-auto mb-1">
          <input
            type="text"
            placeholder="Search tools..."
            className="w-full px-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2e92ff] border-[#2e92ff]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
            <FiSearch />
          </div>
        </div>
      </div>

      <div className="max-w-7xl w-full px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredCards.length > 0 ? (
            filteredCards.map((card, index) => (
              <Card
                key={index}
                name={card.name}
                description={card.description}
                image={card.image}
                onClick={() => handleCardClick(card.path)}
              />
            ))
          ) : (
            <p className="text-lg text-gray-600">No results found</p>
          )}
        </div>
      </div>

      {/* fasdfa */}

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
    </div>
  );
};

export default Home;
