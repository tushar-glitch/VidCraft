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

const compressVideo = async (inputFilePath, outputFilePath, compression_ratio) => {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of default=noprint_wrappers=1:nokey=1 ${inputFilePath}`, (err, bitrate, stderr) => {
            if (err) {
                console.error(err);
                reject(err); // Reject the promise on error
                return;
            }
            if (stderr) {
                // console.error(stderr);
                // reject(stderr); // Reject the promise on stderr
                // return;
            }

            var req_bitrate = bitrate * compression_ratio;
            // exec(`ffmpeg -i ${inputFilePath} -b:v ${Math.ceil(req_bitrate / 1000)}k -bufsize ${Math.ceil(req_bitrate / 1000)}k ${outputFilePath}`, (err, stdout, stderr) => {
            exec(`ffmpeg -i ${inputFilePath} -c:v libx264 -b:v ${Math.ceil(req_bitrate / 1000)}k -c:a aac -b:a 128k ${outputFilePath}`, (err, stdout, stderr) => {
                console.log(`ffmpeg -i ${inputFilePath} -c:v libx264 -b:v ${Math.ceil(req_bitrate / 1000)}k -c:a aac -b:a 128k ${outputFilePath}`);
                
                if (err) {
                    console.error(err);
                    reject(err); // Reject the promise on error
                    return;
                }
                if (stderr) {
                    // console.error(stderr);
                    // reject(stderr); // Reject the promise on stderr
                    // return;
                }

                console.log("Compression finished", req_bitrate);
                resolve(); // Resolve the promise when done
            });
        });
    });
    
};

// [AWS] const uploadToS3 = async (res, outputFilePath, key, output_video_format) => {
// [AWS]     // const fileMime = mime.lookup('mp4') || 'application/octet-stream';
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

app.post('/api/v1/compressor/healthcheck', async (req, res) => {
    res.status(200).json({ msg: "Compressor Service is running!" })
})

// [AWS] app.post('/api/v1/compressor', async (req, res) => {
// [AWS]     
// [AWS]     const { bucket, key } = req.body;
// [AWS]     const download_params = {
// [AWS]         Bucket: bucket,
// [AWS]         Key: key
// [AWS]     }
// [AWS] 
// [AWS]     const query = 'select output_video_format, compression_ratio from video where file_key_name = $1'
// [AWS]     var output_video_format = 'mp4'
// [AWS]     var compression_ratio = 1
// [AWS]     client.query(query, [key], async (err, result) => {
// [AWS]         if (err) {
// [AWS]             console.log(err)
// [AWS]             res.status(400).json({ msg: "Failed to upload video!" })
// [AWS]         }
// [AWS]         else {
// [AWS]             output_video_format = result.rows[0].output_video_format
// [AWS]             compression_ratio = (parseInt(result.rows[0].compression_ratio))/100
// [AWS]         }
// [AWS]     })
// [AWS] 
// [AWS]     try {
// [AWS]         const data = await s3.getObject(download_params).promise();
// [AWS]         const downloadPath = path.join(__dirname, `downloads/${key}.mp4`);
// [AWS]         const outputPath = path.join(__dirname, `outputs/${key}.${output_video_format}`)
// [AWS]         await writeFileAsync(downloadPath, data.Body);
// [AWS]         await compressVideo(downloadPath, outputPath, compression_ratio)
// [AWS]         // await axios.post(`${process.env.backend_endpoint}api/v1/changestatus`, {video_id: key, status:2})
// [AWS]         await axios.post(`http://backend:4000/api/v1/changestatus`, {video_id: key, status:2})
// [AWS]         await uploadToS3(res, outputPath, key, output_video_format)
// [AWS]         // await axios.post(`${process.env.backend_endpoint}api/v1/changestatus`, {video_id: key, status:3})
// [AWS]         await axios.post(`http://backend:4000/api/v1/changestatus`, {video_id: key, status:3})
// [AWS]     }
// [AWS]     catch (err) {
// [AWS]         console.log(err);
// [AWS]         res.status(403).json({ msg: "Something went wrong!" })
// [AWS]     }
// [AWS] 
// [AWS] 
// [AWS] })

app.listen(6875)