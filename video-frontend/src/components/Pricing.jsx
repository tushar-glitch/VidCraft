import React from "react";
import tickImage from "../../src/assets/tick-image.jpg";

const pricingData = [
  {
    title: "Basic",
    price: "9.99",
    maxFileSize: "1 GB",
    conversionMins: "1500 conversion mins/month",
    conversionsAtATime: "100 conversions at a time",
    mergeFiles: "Merge 100 files at a time",
    features: ["Use for Web and API", "No Ads", "High priority"],
  },
  {
    title: "Standard",
    price: "24.99",
    maxFileSize: "2 GB",
    conversionMins: "2000 conversion mins/month",
    conversionsAtATime: "100 conversions at a time",
    mergeFiles: "Merge 100 files at a time",
    features: ["Use for Web and API", "No Ads", "High priority"],
  },
  {
    title: "Pro",
    price: "29.99",
    maxFileSize: "5 GB",
    conversionMins: "4000 conversion mins/month",
    conversionsAtATime: "100 conversions at a time",
    mergeFiles: "Merge 100 files at a time",
    features: ["Use for Web and API", "No Ads", "Highest priority"],
  },
];

const PricingCard = ({
  title,
  price,
  maxFileSize,
  conversionMins,
  conversionsAtATime,
  mergeFiles,
  features,
}) => (
  <div className="border p-16 rounded-lg shadow-md text-center">
    <h3 className="text-3xl font-semibold mb-4">{title}</h3>
    <p className="text-2xl font-bold mb-2 text-blue-600">${price} / Month</p>
    <p className="text-sm text-gray-500 mb-4">(cancel any time)</p>
    <button className="bg-blue-500 text-white px-4 py-2 rounded mb-6 hover:bg-blue-600">
      Get Started →
    </button>
    <ul className="text-left space-y-2">
      <li>
        <strong>
          <img src={tickImage} alt="" className="inline-block w-4 h-4 mr-2" />
          {maxFileSize}
        </strong>{" "}
        maximum file size
      </li>
      <li>
        <img src={tickImage} alt="" className="inline-block w-4 h-4 mr-2" />
        <span className="text-lg">{conversionMins}</span>
      </li>
      <li>
        <img src={tickImage} alt="" className="inline-block w-4 h-4 mr-2" />
        {conversionsAtATime}
      </li>
      <li>
        <img src={tickImage} alt="" className="inline-block w-4 h-4 mr-2" />
        {mergeFiles}
      </li>
      {features.map((feature, index) => (
        <li key={index} className="flex items-center">
          <img src={tickImage} alt="" className="inline-block w-4 h-4 mr-2" />
          {feature}
        </li>
      ))}
    </ul>
  </div>
);

const Pricing = () => (
  <div className="flex flex-col items-center p-24 ubuntu-light">
    <h1 className="text-6xl font-bold text-gray-800 mb-8">
      Choose what suits you best!
    </h1>
    <div className="flex space-x-12 text-xl">
      {pricingData.map((plan, index) => (
        <PricingCard key={index} {...plan} />
      ))}
    </div>
  </div>
);

export default Pricing;
