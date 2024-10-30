import React from "react";
import Sidebar from "./Sidebar";

const Account = () => {
  return (
    <div>
      <Sidebar />
      <div className="pl-60 ubuntu-light">
        <div className="flex justify-center min-h-screen bg-gray-100">
          <div
            style={{ width: "68rem" }}
            className="bg-white rounded-lg mt-12 h-52 shadow-md p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Account Info</h2>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-52">Email:</label>
              <span className="text-gray-600 text-sm">dummyemail@example.com</span>
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-44">Password:</label>
              <span className="text-[#2e92ff] text-sm">Change Password</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
