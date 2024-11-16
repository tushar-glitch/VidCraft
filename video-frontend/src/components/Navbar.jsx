// Navbar.js
import React, { useState, useEffect } from "react";
import SignIn from "./SignIn";
import SignUp from "./SignUp";
import axios from "axios";
import userProfile from "../assets/user-profile.jpg";
import customArrow from "../assets/down-arrow-profile.png";
import { useNavigate } from "react-router-dom";


const backend_endpoint = process.env.REACT_APP_BACKEND_URL;

const Navbar = () => {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const navigateToDashboard = () => {
    navigate("/account");
  }

  const openModalSignin = (e) => {
    e.stopPropagation();
    setIsSignInModalOpen(true);
  };
  const closeModalSignin = () => setIsSignInModalOpen(false);

  const openModalSignup = (e) => {
    e.stopPropagation();
    setIsSignUpModalOpen(true);
  };
  const closeModalSignup = () => setIsSignUpModalOpen(false);

  useEffect(() => {
    axios
      .get(`${backend_endpoint}auth/check-login-status`, {
        withCredentials: true,
      })
      .then((res) => {
        if (res.data.loggedIn) {
          setLoggedIn(true);
          sessionStorage.setItem("isSignedIn", true);
        } else {
          setLoggedIn(false);
          sessionStorage.removeItem("isSignedIn");
        }
      })
      .catch(() => {
        setLoggedIn(false);
        sessionStorage.removeItem("isSignedIn");
      });
  }, [isSignInModalOpen, isSignUpModalOpen]);

  return (
    <nav className="bg-white shadow-md relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="shrink-0 flex items-center">
              <a href="/" className="text-xl font-bold text-gray-800">
                VidCraft
              </a>
            </div>
          </div>
          <div className="flex items-center space-x-8">
            <a href="/" className="text-gray-600 hover:text-[#2e92ff]">
              Tools
            </a>
            <a href="/pricing" className="text-gray-600 hover:text-[#2e92ff]">
              Pricing
            </a>
            <a href="/api" className="text-gray-600 hover:text-[#2e92ff]">
              API
            </a>
            <a href="/contact" className="text-gray-600 hover:text-[#2e92ff]">
              Contact Us
            </a>
          </div>
          <div className="flex items-center space-x-4" onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}>
            {loggedIn ? (
              <div
                className="relative flex items-center space-x-2 p-2 cursor-pointer"
                // onMouseEnter={() => setIsDropdownOpen(true)}
                // onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <img
                  src={userProfile}
                  alt="Profile"
                  className="w-12 h-12 space-y-2 rounded-full"
                  // onMouseEnter={() => setIsDropdownOpen(true)}
                  // onMouseLeave={() => setIsDropdownOpen(false)}
                />
                <img
                  src={customArrow}
                  alt="Arrow"
                  className={`w-4 h-4 ml-2 space-y-2 transition-transform cursor-pointer ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                  // onMouseEnter={() => setIsDropdownOpen(true)}
                  // onMouseLeave={() => setIsDropdownOpen(false)}
                />
                {isDropdownOpen && (
                  <div
                    className="absolute left-0 mt-36 w-40 bg-white-600 z-100 border border-gray-300 rounded shadow-md"
                    // onMouseEnter={() => setIsDropdownOpen(true)}
                    // onMouseLeave={() => setIsDropdownOpen(false)}
                  >
                    <ul className="flex flex-col">
                      <li
                        className="px-4 py-2 text-gray-700 hover:bg-blue-100 cursor-pointer"
                        onClick={() => navigateToDashboard()}
                      >
                        Account
                      </li>
                      <li
                        className="px-4 py-2 text-red-700 hover:bg-red-100 cursor-pointer"
                        // onClick={() => handleLogout()}
                      >
                        Logout
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={openModalSignin}
                  className="text-gray-600 hover:text-[#2e92ff]"
                >
                  Login
                </button>
                <button
                  onClick={openModalSignup}
                  className="px-4 py-2 border-2 border-[#2e92ff] bg-white text-[#2e92ff] rounded-md hover:bg-[#2e92ff] hover:text-white"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black opacity-20 shadow-sm"></div>
      <SignIn
        isOpen={isSignInModalOpen}
        onClose={closeModalSignin}
        setLoggedIn={setLoggedIn}
      />
      <SignUp
        isOpen={isSignUpModalOpen}
        onClose={closeModalSignup}
        setLoggedIn={setLoggedIn}
      />
    </nav>
  );
};

export default Navbar;
