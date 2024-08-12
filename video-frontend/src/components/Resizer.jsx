import React from 'react';
import { FiX, FiFileText } from "react-icons/fi";

const Resizer = () => {
  return (
    <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg shadow-md p-6">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <FiFileText className="text-gray-500 mr-2" size={20} />
          <span className="text-gray-700">sample_video2.mp4</span>
        </div>
        <FiX className="text-gray-500 cursor-pointer" size={20} />
      </div>
      
      {/* Size Info */}
      <div className="flex justify-between items-center text-gray-600 mb-4">
        <span>Original size: <strong>14.12 MB</strong></span>
        <span>Expected size: <strong>2.82 MB (-80%)</strong></span>
      </div>

      {/* Compression Options */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="border border-[#2e92ff] p-4 rounded-lg cursor-pointer text-center">
          <h3 className="font-semibold text-lg">Basic</h3>
          <p className="text-gray-600">Medium file size, high quality</p>
        </div>
        <div className="border border-gray-200 p-4 rounded-lg cursor-pointer text-center">
          <h3 className="font-semibold text-lg">Strong</h3>
          <p className="text-gray-600">Smallest file size, low quality</p>
        </div>
        <div className="border border-gray-200 p-4 rounded-lg cursor-pointer text-center relative">
          <h3 className="font-semibold text-lg">Superb</h3>
          <p className="text-gray-600">Small file size, high quality</p>
          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">PRO</span>
        </div>
      </div>

      {/* Audio Track */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-600">Audio track:</span>
        <div className="relative">
          <select className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-[#2e92ff] focus:border-[#2e92ff]">
            <option>Remove</option>
            <option>Keep</option>
          </select>
        </div>
      </div>

      {/* Compress Button */}
      <button className="w-full bg-[#2e92ff] text-white py-3 px-6 rounded-lg shadow-md font-bold text-lg hover:bg-[#1c6eff]">
        Compress
      </button>
    </div>
  );
};

export default Resizer;
