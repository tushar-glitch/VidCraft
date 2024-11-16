import React from "react";
import Sidebar from "./Sidebar";

const Account = () => {
  return (
    <div>
      <Sidebar />
      <div className="ubuntu-light">
        <div className="flex flex-col items-center min-h-screen bg-gray-100 space-y-6 pb-6">
          {/* First Card */}
          <div
            style={{ width: "68rem" }}
            className="bg-white rounded-lg mt-12 shadow-md p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Account Info</h2>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-52">Email:</label>
              <span className="text-gray-600 text-sm">
                dummyemail@example.com
              </span>
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-44">Password:</label>
              <span className="text-[#2e92ff] text-sm">Change Password</span>
            </div>
          </div>

          {/* Billing card */}
          <div
            style={{ width: "68rem", height: "40rem" }}
            className="bg-white rounded-lg shadow-md p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-4">Billing Info</h2>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-52">Name:</label>
              <input
                type="name"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-52">Tax ID:</label>
              <input
                type="tax"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-48">Address:</label>
              <input
                type="address"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-36">Address Line 2:</label>
              <input
                type="address2"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-56">City</label>
              <input
                type="city"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-28">Zip or Postal Code</label>
              <input
                type="pin-code"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>
            <hr className="mb-4" />
            <div className="mb-4 flex items-center">
              <label className="font-medium mr-48">Country</label>
              <input
                type="country"
                // placeholder="Name or Business"
                className="text-gray-600 text-sm border border-gray-300 rounded-md p-2 hover:ring-1 hover:ring-black focus:outline-none focus:ring-1 focus:ring-[#2e92ff] w-full max-w-xs"
              />
            </div>

            <div className="flex justify-center">
              <button
                className="bg-[#2e92ff] hover:bg-[#2e92ff]
              text-white py-2 px-4 rounded-md w-full mt-4 transition duration-200 transform active:scale-95"
              >
                Update billing info
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
