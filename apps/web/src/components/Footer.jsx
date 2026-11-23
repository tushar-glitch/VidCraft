import React from "react";

const Footer = () => {
  return (
    <footer className="bg-zinc-50 text-center text-surface/75 dark:bg-neutral-700 dark:text-white/75 lg:text-left ubuntu-light">
      <div className="flex items-center justify-center border-b-2 border-neutral-200 p-6 dark:border-white/10 lg:justify-between">
        <div className="me-12 hidden lg:block">
          <span>© 2024 VidCraft. All Rights Reserved.</span>
        </div>
        {/* Navigation links container */}
        <div className="flex justify-center space-x-8">
          <a href="#!" className="text-md">
            About
          </a>
          <a href="#!" className="text-md">
            Pricing
          </a>
          <a href="#!" className="text-md">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
