// Navbar.js
import React, {useState} from "react";
import SignIn from "./SignIn";

const Navbar = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <nav className="bg-white shadow-md relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="shrink-0 flex items-center">
              <a href="/" className="text-xl font-bold text-gray-800">
                Editor
              </a>
            </div>
          </div>
          <div className="flex items-center space-x-8">
            <a href="/" className="text-gray-600 hover:text-[#2e92ff]">
              Tools
            </a>
            <a href="/" className="text-gray-600 hover:text-[#2e92ff]">
              Pricing
            </a>
            <a href="/" className="text-gray-600 hover:text-[#2e92ff]">
              API
            </a>
            <a href="/" className="text-gray-600 hover:text-[#2e92ff]">
              Contact Us
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-600 hover:text-[#2e92ff]">
              Login
            </button>
            <button
              onClick={openModal}
              className="px-4 py-2 border-2 border-[#2e92ff] bg-white text-[#2e92ff] rounded-md hover:bg-[#2e92ff] hover:text-white"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black opacity-20 shadow-sm"></div>
      <SignIn isOpen={isModalOpen} onClose={closeModal} />
    </nav>
  );
};

export default Navbar;
