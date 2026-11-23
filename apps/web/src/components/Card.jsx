import React from "react";


const Card = ({ name, description, image, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="max-w-sm p-6 bg-white border border-gray-200 rounded-lg shadow cursor-pointer transition-transform transform hover:scale-105 hover:shadow-xl"
    >
      <img src={image} alt="" className="w-7 h-7 text-gray-500 dark:text-gray-400 mb-3" />
      <a href="#">
        <h5 className="mb-2 text-2xl font-semibold tracking-tight text-gray-600">{name}</h5>
      </a>
      <p className="mb-3 font-normal text-gray-500 dark:text-gray-400">{description}</p>
      <a href="#" className="inline-flex font-medium items-center text-blue-600 hover:underline">
        See more
        <svg
          className="w-3 h-3 ms-2.5 rtl:rotate-[270deg]"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 18 18"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 11v4.833A1.166 1.166 0 0 1 13.833 17H2.167A1.167 1.167 0 0 1 1 15.833V4.167A1.166 1.166 0 0 1 2.167 3h4.618m4.447-2H17v5.768M9.111 8.889l7.778-7.778"
          />
        </svg>
      </a>
    </div>
  );
};

export default Card;

// import React from "react";
// import sampleimg from "../assets/compress3.png"

// const Card = ({ name, description, image, onClick }) => {
//   return (



//     <div onClick={onClick} className="bg-white shadow-lg rounded-lg overflow-hidden transition-transform transform hover:scale-105 hover:shadow-xl cursor-pointer">
//       <img src={sampleimg} alt={name} className="w-full h-40 object-cover" />
//       <div className="p-6">
//         <h2 className="text-xl font-semibold text-gray-800 mb-3">{name}</h2>
//         <p className="text-gray-600">{description}</p>
//       </div>
//     </div>
//   );
// };

// export default Card;
