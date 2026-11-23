import { useState } from 'react';
import { FiArrowRight, FiSearch } from 'react-icons/fi';
import { Link } from 'react-router';
import AddWatermarkImg from '../assets/add-watermark.png';
import CompressImg from '../assets/compress.png';
import FormatImg from '../assets/format-conversion.png';
import MergeImg from '../assets/merge.png';
import ResizeImg from '../assets/resize.png';
import TrimImg from '../assets/trim.png';
import { FeatureList } from '../components/FeatureList.tsx';

const TOOLS = [
  { name: 'Video Compression', description: 'Reduce the file size of your videos.', image: CompressImg, path: '/compress' },
  { name: 'Video Resize', description: 'Change the dimensions of your videos.', image: ResizeImg, path: '/resize' },
  { name: 'Format Conversion', description: 'Convert your videos to different formats.', image: FormatImg },
  { name: 'Add Watermark', description: 'Add a custom watermark to your videos.', image: AddWatermarkImg },
  { name: 'Trim Video', description: 'Cut and trim your videos easily.', image: TrimImg },
  { name: 'Merge Videos', description: 'Combine multiple videos into one.', image: MergeImg },
];

const cardClass = 'block rounded-lg border border-gray-200 bg-white p-6 shadow';

export function Home() {
  const [query, setQuery] = useState('');
  const tools = TOOLS.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex flex-col items-center px-4 py-16">
      <div className="mb-12 max-w-3xl text-center">
        <h1 className="mb-4 text-5xl font-bold text-gray-800">Transform Your Videos with Ease</h1>
        <p className="mb-6 text-lg text-gray-600">
          Compress and resize videos right in your browser. Fast, free, and no sign-up needed.
        </p>
        <div className="relative mx-auto w-full max-w-md">
          <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            placeholder="Search tools..."
            aria-label="Search tools"
            className="w-full rounded-md border border-brand py-2 pr-3 pl-10 shadow-sm focus:ring-2 focus:ring-brand focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-1 gap-6 px-4 sm:grid-cols-2 md:grid-cols-3">
        {tools.length === 0 && <p className="text-lg text-gray-600">No results found</p>}
        {tools.map((tool) => {
          const body = (
            <>
              <img src={tool.image} alt="" className="mb-3 h-7 w-7" />
              <h2 className="mb-2 text-2xl font-semibold tracking-tight text-gray-600">{tool.name}</h2>
              <p className="mb-3 text-gray-500">{tool.description}</p>
              {tool.path ? (
                <span className="inline-flex items-center gap-1 font-medium text-blue-600">
                  Open tool <FiArrowRight />
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Coming soon</span>
              )}
            </>
          );
          return tool.path ? (
            <Link key={tool.name} to={tool.path} className={`${cardClass} transition-transform hover:scale-105 hover:shadow-xl`}>
              {body}
            </Link>
          ) : (
            <div key={tool.name} className={`${cardClass} opacity-70`}>
              {body}
            </div>
          );
        })}
      </div>
      <FeatureList />
    </div>
  );
}
