import React, { useEffect, useState } from "react";
import axios from 'axios'


const backend_endpoint = process.env.REACT_APP_BACKEND_URL;

const TaskCard = () => {
  const [tasks, setTasks] = useState([]);

  // Fetch task data from API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get(
          `${backend_endpoint}account/getalltasks`,
          {
            withCredentials: true,
          }
        )
        setTasks(response.data);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };

    fetchTasks();
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="py-2 px-4 text-sm font-medium text-gray-600 border-b uppercase">
              Task ID
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
        <tbody>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <tr key={task.id}>
                <td className="py-3 px-4 text-sm text-gray-700 border-b">{task.id}</td>
                <td className="py-3 px-4 text-sm text-gray-700 border-b">{(task.operation == 1)?"Compression":"Resize"}</td>
                <td className="py-3 px-4 text-sm text-gray-700 border-b">
                  {task.status === "completed" ? (
                    <span className="text-green-600">🟢 {task.status}</span>
                  ) : (
                    <span className="text-yellow-600">🟡 {task.status}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 border-b">
                  <a
                    className={`bg-${
                      task.download_link ? "[#2e92ff]" : "gray-400"
                      } text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-600 transition`}
                    href={task.download_link}
                    download
                    // onClick={() => downloadTask(task.download_link)}
                    // disabled={!task.download_link}
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                className="py-3 px-4 text-sm text-gray-500 border-b"
                colSpan="4"
              >
                No tasks available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskCard;
