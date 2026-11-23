// [AWS DISABLED] AWS (S3/SQS) is no longer used in VidCraft. Lines prefixed with "// [AWS] " are kept only for reference.
const express = require('express');
const app = express();
const cors = require('cors');
// [AWS] const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const ffmpeg = require('fluent-ffmpeg');
const writeFileAsync = promisify(fs.writeFile);
const ffmpegPath = require('ffmpeg-static');
const mime = require('mime-types');
const axios = require('axios');

ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config();

const client = require('../../db/conn');

client.connect(function (err) {
    if (err) throw err;
    client.query("", [], function (err, result) {
        if (err) throw err;
        console.log(result.rows[0]);
    });
});

app.use(cors());
app.use(express.json());

// [AWS] const s3 = new AWS.S3({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY,
// [AWS] });

const resizeVideo = async (inputFilePath, outputFilePath, width, height) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputFilePath)
            .output(outputFilePath)
            .size(`${width}x${height}`)
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('end', () => {
                console.log('Resizing finished.');
                resolve();
            })
            .on('error', (err) => {
                console.error('Error resizing video:', err);
                reject(err);
            })
            .run();
    });
};

// [AWS] const uploadToS3 = async (res, outputFilePath, key) => {
// [AWS]     const fileMime = mime.lookup('mp4') || 'application/octet-stream';
// [AWS]     const fileSize = fs.statSync(outputFilePath).size;
// [AWS]     const file_size_in_mb = fileSize / (1024 * 1024).toFixed(2);
// [AWS]     const output_file_size = (file_size_in_mb >= 1) ? (file_size_in_mb) : (file_size_in_mb * 1024);
// [AWS]     const file_unit = (file_size_in_mb >= 1) ? ("MB") : ("KB");
// [AWS] 
// [AWS]     const params = {
// [AWS]         Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]         Key: key,
// [AWS]         Body: fs.createReadStream(outputFilePath),
// [AWS]         // ContentType: 'video/mp4'
// [AWS]     };
// [AWS] 
// [AWS]     s3.upload(params, async (err, data) => {
// [AWS]         if (err) {
// [AWS]             console.log(err);
// [AWS]         } else {
// [AWS]             console.log("File uploaded successfully", data);
// [AWS]             const urlParams = {
// [AWS]                 Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]                 Key: key,
// [AWS]                 Expires: 8 * 60 * 60, // 8 hours
// [AWS]                 ResponseContentDisposition: `attachment; filename="${key}.mp4"`,
// [AWS]                 ResponseContentType: 'video/mp4',
// [AWS]             };
// [AWS]             s3.getSignedUrl('getObject', urlParams, async (err, url) => {
// [AWS]                 if (err) console.log(err);
// [AWS]                 else {
// [AWS]                     const query = 'UPDATE video SET url = $1, output_video_size = $2, output_video_unit = $3 WHERE video_id = $4';
// [AWS]                     client.query(query, [url, output_file_size, file_unit, key], async (err, result) => {
// [AWS]                         if (err) {
// [AWS]                             console.log(err);
// [AWS]                             res.status(400).json({ msg: "Failed to upload video!" });
// [AWS]                         } else {
// [AWS]                             console.log("Video processed successfully");
// [AWS]                             res.status(200).json({ msg: "Video uploaded successfully", url: url, size: output_file_size, unit: file_unit });
// [AWS]                         }
// [AWS]                     });
// [AWS]                 }
// [AWS]             });
// [AWS]         }
// [AWS]     });
// [AWS] };

// [AWS] app.post('/api/v1/transcoder', async (req, res) => {
// [AWS]     const { bucket, key, width, height } = req.body;
// [AWS]     const download_params = {
// [AWS]         Bucket: bucket,
// [AWS]         Key: key,
// [AWS]     };
// [AWS]     try {
// [AWS]         const data = await s3.getObject(download_params).promise();
// [AWS]         const downloadPath = path.join(__dirname, `downloads/${key}.mp4`);
// [AWS]         const outputPath = path.join(__dirname, `outputs/${key}_resized.mp4`);
// [AWS]         await writeFileAsync(downloadPath, data.Body);
// [AWS]         await resizeVideo(downloadPath, outputPath, width, height);
// [AWS]         await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: key, status: 2 });
// [AWS]         await uploadToS3(res, outputPath, key);
// [AWS]         await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: key, status: 3 });
// [AWS]     } catch (err) {
// [AWS]         console.log(err);
// [AWS]         res.status(403).json({ msg: "Something went wrong!" });
// [AWS]     }
// [AWS] });

app.listen(6876)
