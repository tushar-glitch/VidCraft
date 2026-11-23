import React from "react";
import Sidebar from "./Sidebar";
import TaskCard from "./TaskCard";

const Tasks = () => {
  return (
    <div>
      <Sidebar />
      <div className="pl-60 ubuntu-light">
        <div className="flex justify-center min-h-screen bg-gray-100">
          <div
            style={{ width: "68rem" }}
            className="bg-white rounded-lg h-52 mt-12 shadow-md p-6 min-h-screen"
          >
            <h2 className="text-xl font-semibold mb-4">Tasks</h2>
            <TaskCard />
          </div>
        </div>
      </div>
      {/* <div className="pl-60 ubuntu-light">
        <div className="flex justify-center min-h-screen bg-gray-100">
          <div
            style={{ width: "68rem" }}
            className="bg-white rounded-lg h-52 mt-12 shadow-md p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Invoices</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="py-2 px-4 text-sm font-medium text-gray-600 border-b uppercase">
                      Task id
                    </th>
                    <th className="py-2 px-4 text-sm font-medium text-gray-600 border-b uppercase">
                      Operation
                    </th>
                    <th className="py-2 px-4 text-sm font-medium text-gray-600 border-b uppercase">
                      Status
                    </th>
                    <th className="py-2 px-4 text-sm font-medium text-gray-600 border-b uppercase">
                      Download
                    </th>
                  </tr>
                </thead>
              </table>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default Tasks;
