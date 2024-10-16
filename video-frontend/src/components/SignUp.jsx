import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import axios from "axios";

const backend_endpoint = process.env.REACT_APP_BACKEND_URL;

const SignUp = ({ isOpen, onClose, setLoggedIn }) => {
  const [errors, setErrors] = useState({
    fname: "",
    lname: "",
    email: "",
    password: "",
  });

  if (!isOpen) return null;

  const handlesignup = (e) => {
    e.preventDefault();
    const fname = document.getElementById("fname").value;
    const lname = document.getElementById("lname").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    setErrors({
      fname: "",
      lname: "",
      email: "",
      password: "",
    });

    const nameRegex = /^(?=.{1,50}$)[a-z]+(?:['_.\s][a-z]+)*$/i
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const passRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,16}$/

    const validate_name = (name) => {
      return (
        name.toLowerCase().match(nameRegex)
      )
    }

    const validate_email = (email) => {
      return (
        email.match(emailRegex)
      )
    }

    const validate_pass = (pass) => {
      return (
        pass.match(passRegex)
      )
    }

    if (!fname) {
      setErrors((prev) => ({ ...prev, fname: "First name is required" }));
      return;
    }
    if (!validate_name(fname)) {
      setErrors((prev) => ({ ...prev, fname: "Should only contains characters" }))
      return;
    }
    if (!email) {
      setErrors((prev) => ({ ...prev, email: "Email is required" }));
      return;
    }
    if (!validate_email(email)) {
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      return;
    }
    if (!password) {
      setErrors((prev) => ({ ...prev, password: "Password is required" }));
      return;
    }
    if (!validate_pass(password)) {
      setErrors((prev) => ({ ...prev, password: "Please enter a valid password" }));
      return;
    }
    if (fname && email && password) {
      axios
        .post(
          `${backend_endpoint}auth/register`,
          {
            firstname: fname,
            lastname: lname,
            email: email,
            password: password,
          },
          {
            withCredentials: true,
          }
        )
        .then((res) => {
          sessionStorage.setItem("isSignedIn", true);
          setLoggedIn(true);
          onClose();
        })
        .catch((err) => {
          console.log(err);
        });
    }
    else return
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50 ubuntu-light"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Sign Up to our platform
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
            <div className="flex space-x-8">
              <div>
                <label
                  htmlFor="fname"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Your First name
                </label>
                <input
                  type="text"
                  name="fname"
                  id="fname"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  placeholder="First name"
                  required
                />
                {errors.fname && (
                  <p className="text-red-500 text-sm mt-1">{errors.fname}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="lname"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Your Last name
                </label>
                <input
                  type="lname"
                  name="lname"
                  id="lname"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  placeholder="Last name"
                />
                {errors.lname && (
                  <p className="text-red-500 text-sm mt-1">{errors.lname}</p>
                )}
              </div>
            </div>
            <div>
              <label
                htmlFor="lname"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Your email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                placeholder="name@company.com"
                required
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
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
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
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
            </div>
            <button
              type="button"
              className="w-full text-white bg-[#2e92ff] hover:bg-blue-800 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              onClick={handlesignup}
            >
              Create your account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
