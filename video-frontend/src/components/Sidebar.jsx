import React from 'react';
import { FiShoppingCart, FiCreditCard, FiFileText, FiList, FiClipboard, FiKey, FiAnchor, FiUser, FiSettings, FiBell, FiUsers, FiActivity, FiHelpCircle } from 'react-icons/fi';

const Sidebar = () => {
  return (
    <aside className="fixed top-[4rem] left-0 z-40 w-60 h-screen bg-white border-r border-gray-200 text-gray-700 ubuntu-light">
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase mb-4">Billing</h2>
        <nav className="space-y-2">
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiShoppingCart className="w-5 h-5 mr-3" />
            Billing Plan
          </a>
          {/* <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100">
            <FiCreditCard className="w-5 h-5 mr-3" />
            Payment Method
          </a> */}
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiFileText className="w-5 h-5 mr-3" />
            Invoice
          </a>
        </nav>

        <h2 className="text-xs font-semibold text-gray-400 uppercase mt-6 mb-4">API</h2>
        <nav className="space-y-2">
          {/* <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100">
            <FiList className="w-5 h-5 mr-3" />
            Tasks
          </a> */}
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiClipboard className="w-5 h-5 mr-3" />
            Jobs
          </a>
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiKey className="w-5 h-5 mr-3" />
            API Keys
          </a>
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiAnchor className="w-5 h-5 mr-3" />
            Webhooks
          </a>
        </nav>

        <h2 className="text-xs font-semibold text-gray-400 uppercase mt-6 mb-4">Settings</h2>
        <nav className="space-y-2">
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiUser className="w-5 h-5 mr-3" />
            Account
          </a>
          {/* <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100">
            <FiSettings className="w-5 h-5 mr-3" />
            Presets
          </a> */}
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiBell className="w-5 h-5 mr-3" />
            Notifications
          </a>
          {/* <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100">
            <FiUsers className="w-5 h-5 mr-3" />
            Team
          </a>
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100">
            <FiActivity className="w-5 h-5 mr-3" />
            Activity
          </a> */}
          <a href="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 rounded-lg hover:bg-gray-100 hover:text-[#2e92ff]">
            <FiHelpCircle className="w-5 h-5 mr-3" />
            FAQ
          </a>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;

