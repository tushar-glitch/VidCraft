import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import axios from "axios";

const backend_endpoint = process.env.REACT_APP_BACKEND_URL;

const SignIn = ({ isOpen, onClose, setLoggedIn }) => {
  if (!isOpen) return null;
  const handleLogin = (e) => {
    e.preventDefault();
    const emailorusername = document.getElementById("emailorusername").value;
    const password = document.getElementById("password").value;
    console.log(emailorusername, password);

    if (emailorusername && password) {
      axios
        .post(
          `${backend_endpoint}auth/login`,
          {
            username_or_email: emailorusername,
            password: password,
          },
          {
            withCredentials: true,
          }
        )
        .then((res) => {
          setLoggedIn(true);
          sessionStorage.setItem("isSignedIn", true)
          window.dispatchEvent(new Event('loginStatusChanged'));
          onClose();
        })
        .catch((err) => {
          console.log(err);
        });
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Sign in to our platform
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-900"
            onClick={onClose}
          >
            <FiX className="w-6 h-6" />
            <span className="sr-only">Close modal</span>
          </button>
        </div>
        {/* Modal body */}
        <div className="p-4">
          <form className="space-y-4">
            <div>
              <label
                htmlFor="text"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Your email or username
              </label>
              <input
                type="text"
                name="emailorusername"
                id="emailorusername"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                placeholder="Username or email"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Your password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                placeholder="••••••••"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                required
              />
            </div>
            <div className="flex justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-blue-300"
                />
                <label
                  htmlFor="remember"
                  className="ms-2 text-sm font-medium text-gray-900"
                >
                  Remember me
                </label>
              </div>
              <a href="#" className="text-sm text-blue-700 hover:underline">
                Forgot Password?
              </a>
            </div>
            <button
              type="submit"
              className="w-full text-white bg-[#2e92ff] hover:bg-blue-800 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              onClick={handleLogin}
            >
              Login to your account
            </button>
            <div className="text-sm font-medium text-gray-500">
              Not registered?{" "}
              <a href="#" className="text-blue-700 hover:underline">
                Create account
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
