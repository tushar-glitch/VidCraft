// [AWS DISABLED] AWS (S3/SQS) is no longer used in VidCraft. Lines prefixed with "// [AWS] " are kept only for reference.
const express = require('express')
const app = express()
const cors = require('cors')
// [AWS] const AWS = require('aws-sdk')
const path = require('path')
const fs = require('fs')
const { promisify, formatWithOptions } = require('util');
const ffmpeg = require('fluent-ffmpeg')
const writeFileAsync = promisify(fs.writeFile);
const ffmpegPath = require('ffmpeg-static');
const mime = require('mime-types')
const { getVideoDurationInSeconds } = require('get-video-duration')
const axios = require('axios')
const {exec} = require('child_process')


ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config()

const client = require('./db/conn')

client.connect(function (err) {
    if (err) throw err;
    client.query("", [], function (err, result) {
        if (err) throw err;

        console.log(result.rows[0]);
        //   client.end(function (err) {
        //     if (err) throw err;
        //   });
    });
});

app.use(cors())

app.use(express.json())

// [AWS] const s3 = new AWS.S3({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY
// [AWS] });

const resizeVideo = async (inputFilePath, outputFilePath, width, height) => {
    // return new Promise((resolve, reject) => {
    //     ffmpeg(inputFilePath)
    //         .output(outputFilePath)
    //         .videoCodec('libx264')       // Use H.264 codec
    //         .audioCodec('aac')           // Set audio codec to AAC
    //         .audioBitrate('128k')        // Audio bitrate
    //         .size(`${width}x${height}`)  // Resize to the desired width and height
    //         .videoBitrate('1000k')       // Set video bitrate
    //         .outputOptions('-vf', `scale=${width}:${height}`) // Ensure correct scaling filter
    //         .outputOptions('-aspect', `${width}:${height}`)   // Force correct aspect ratio
    //         .on('end', () => {
    //             console.log('Resizing finished.');
    //             resolve();
    //         })
    //         .on('error', (err) => {
    //             console.error('Error resizing video:', err);
    //             reject(err);
    //         })
    //         .run();
    // });

    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${inputFilePath} -vf "scale=${width}:${height}" -c:v libx264 -c:a aac -b:a 128k -aspect ${width}:${height} ${outputFilePath}`, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(err); // Reject the promise on error
                return;
            }
            if (stderr) {
                
            }
            console.log("Resizing finished bro!");
            resolve()
        });
    });
};



// [AWS] const uploadToS3 = async (res, outputFilePath, key, output_video_format) => {
// [AWS]     // const fileMime = mime.lookup('mp4') || 'application/octet-stream';
// [AWS]     console.log('Tushar1');
// [AWS]     
// [AWS]     const fileSize = fs.statSync(outputFilePath).size;
// [AWS]     const file_size_in_mb = fileSize / (1024 * 1024).toFixed(2)
// [AWS]     const output_file_size = (file_size_in_mb >= 1) ? (file_size_in_mb) : (file_size_in_mb * 1024);
// [AWS]     const file_unit = (file_size_in_mb >= 1) ? ("MB") : ("KB");
// [AWS]     const params = {
// [AWS]         Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]         Key: `${key}.${output_video_format}`,
// [AWS]         Body: fs.createReadStream(outputFilePath),
// [AWS]         ContentType: `video/${output_video_format}`
// [AWS]     }
// [AWS]     console.log('Tushar2');
// [AWS]     s3.upload(params, async (err, data) => {
// [AWS]         if (err) {
// [AWS]             console.log(err);
// [AWS]         }
// [AWS]         else {
// [AWS]             console.log("File uploaded successfully", data);
// [AWS]             const urlParams = {
// [AWS]                 Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]                 Key: `${key}.${output_video_format}`,
// [AWS]                 Expires: 8 * 60 * 60, // 8 hour
// [AWS]                 ResponseContentDisposition: `attachment; filename="${key}.${output_video_format}"`,
// [AWS]                 ResponseContentType: `video/${output_video_format}`
// [AWS]             };
// [AWS]             s3.getSignedUrl('getObject', urlParams, async (err, url) => {
// [AWS]                 if (err) console.log(err);
// [AWS]                 else {
// [AWS]                     const stream = fs.createReadStream(outputFilePath)
// [AWS]                     // const duration = await getVideoDurationInSeconds(stream)
// [AWS] 
// [AWS]                     const query = 'Update video set url = $1, output_video_size = $2, output_video_unit = $3'
// [AWS]                     client.query(query, [url, output_file_size, file_unit], async (err, result) => {
// [AWS]                         if (err) {
// [AWS]                             console.log(err)
// [AWS]                             res.status(400).json({ msg: "Failed to upload video!" })
// [AWS]                         }
// [AWS]                         else {
// [AWS]                             console.log("Video processed successfully");
// [AWS]                             res.status(200).json({ msg: "Video uploaded successfully", url: url, size: output_file_size, unit: file_unit });
// [AWS]                         }
// [AWS]                     })
// [AWS]                 }
// [AWS]             })
// [AWS]         }
// [AWS]     })
// [AWS] }


// [AWS] app.post('/api/v1/resizer', async (req, res) => {
// [AWS]     const { bucket, key } = req.body;
// [AWS]     const download_params = {
// [AWS]         Bucket: bucket,
// [AWS]         Key: key
// [AWS]     }
// [AWS]     var req_height, req_width
// [AWS]     var output_video_format = 'mp4'
// [AWS]     const query = 'select req_width, req_height from video where file_key_name = $1'
// [AWS]     client.query(query, [key], async (err, result) => {
// [AWS]         if (err) {
// [AWS]             console.log(err)
// [AWS]             res.status(400).json({ msg: "Failed to upload video!" })
// [AWS]         }
// [AWS]         else {
// [AWS]             req_width = result.rows[0].req_width;
// [AWS]             req_height = result.rows[0].req_height;
// [AWS]             (req_width % 2 == 1) ? req_width++ : req_width;
// [AWS]             (req_height % 2 == 1) ? req_height++ : req_height;
// [AWS]         }
// [AWS]     })
// [AWS] 
// [AWS]     try {
// [AWS]        const data = await s3.getObject(download_params).promise();
// [AWS]         const downloadPath = path.join(__dirname, `downloads/${key}.mp4`);
// [AWS]         const outputPath = path.join(__dirname, `outputs/${key}.mp4`)
// [AWS]         await writeFileAsync(downloadPath, data.Body);
// [AWS]         await resizeVideo(downloadPath, outputPath, req_width, req_height)
// [AWS]         // await axios.post(`${process.env.backend_endpoint}api/v1/changestatus`, {video_id: key, status:2})
// [AWS]         await axios.post(`http://backend:4000/api/v1/changestatus`, {video_id: key, status:2})
// [AWS]         await uploadToS3(res, outputPath, key, output_video_format)
// [AWS]         // await axios.post(`${process.env.backend_endpoint}api/v1/changestatus`, { video_id: key, status: 3 })
// [AWS]         await axios.post(`http://backend:4000/api/v1/changestatus`, {video_id: key, status:3})
// [AWS]     }
// [AWS]     catch (err) {
// [AWS]         console.log(err);
// [AWS]         res.status(403).json({ msg: "Something went wrong!" })
// [AWS]     }
// [AWS] 
// [AWS] 
// [AWS] })

app.listen(6876)