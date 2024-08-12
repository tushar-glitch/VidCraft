const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

console.log("In transcoder");
// const inputPath = path.join(__dirname, 'downloads/sample_video2.mp4');

// // Define resolutions and their corresponding sizes
// const resolutions = {
//     '480p': '854x480',
//     '720p': '1280x720',
//     '1080p': '1920x1080',
//     '4K': '3840x2160', // Added 4K resolution
// };

// const outputDir = path.join(__dirname, 'converted_videos');

// // Create the output directory if it doesn't exist
// if (!fs.existsSync(outputDir)) {
//     fs.mkdirSync(outputDir);
// }

// const convertToResolution = (resolution, size) => {
//     const start = Date.now()
//     const outputPath = path.join(outputDir, `output_${resolution}.mp4`);

//     ffmpeg(inputPath)
//         .output(outputPath)
//         .videoCodec('libx264')
//         .size(size)
//         .on('end', () => {
//             console.log(`Conversion to ${resolution} finished: ${outputPath}`);
//         })
//         .on('error', (err) => {
//             console.error(`Error converting to ${resolution}`, err);
//         })
//         .run();
//     const end = Date.now()
//     console.log(`Time taken for ${resolution}: ${(end-start*1000)}sec`)
// };

// // Convert video to all specified resolutions
// Object.entries(resolutions).forEach(([resolution, size]) => {
//     convertToResolution(resolution, size);
// });
