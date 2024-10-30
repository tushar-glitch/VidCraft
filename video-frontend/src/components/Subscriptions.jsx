import React from "react";
import Sidebar from "./Sidebar";

const Subscriptions = () => {
  return (
    <div>
      <Sidebar />
      <div className="pl-60 ubuntu-light">
        <div className="flex justify-center min-h-screen bg-gray-100">
          <div
            style={{ width: "68rem" }}
            className="bg-white rounded-lg h-52 mt-12 shadow-md p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Subscriptions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="py-2 px-4 text-xs font-medium text-gray-600 border-b uppercase">
                      Package
                    </th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-600 border-b uppercase">
                      Next Renewal
                    </th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-600 border-b uppercase">
                      Price
                    </th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-600 border-b uppercase">
                      Status
                    </th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-600 border-b uppercase">
                      Available Minutes
                    </th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-600 border-b uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 px-4 text-sm text-gray-700 border-b">
                      Free
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 border-b">
                      30 Oct 2024
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 border-b">
                      $0
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 border-b">
                    🟢active
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 border-b">
                      19/20
                    </td>
                    <td className="py-3 px-4 text-sm border-b">
                      <button className="bg-[#2e92ff] text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-600 transition">
                        Upgrade
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscriptions;
