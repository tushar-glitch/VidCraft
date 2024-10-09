const express = require('express');
const app = express();
const cors = require('cors');
const AWS = require('aws-sdk');
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

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
});

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

const uploadToS3 = async (res, outputFilePath, key) => {
    const fileMime = mime.lookup('mp4') || 'application/octet-stream';
    const fileSize = fs.statSync(outputFilePath).size;
    const file_size_in_mb = fileSize / (1024 * 1024).toFixed(2);
    const output_file_size = (file_size_in_mb >= 1) ? (file_size_in_mb) : (file_size_in_mb * 1024);
    const file_unit = (file_size_in_mb >= 1) ? ("MB") : ("KB");

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: fs.createReadStream(outputFilePath),
        // ContentType: 'video/mp4'
    };

    s3.upload(params, async (err, data) => {
        if (err) {
            console.log(err);
        } else {
            console.log("File uploaded successfully", data);
            const urlParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
                Expires: 8 * 60 * 60, // 8 hours
                ResponseContentDisposition: `attachment; filename="${key}.mp4"`,
                ResponseContentType: 'video/mp4',
            };
            s3.getSignedUrl('getObject', urlParams, async (err, url) => {
                if (err) console.log(err);
                else {
                    const query = 'UPDATE video SET url = $1, output_video_size = $2, output_video_unit = $3 WHERE video_id = $4';
                    client.query(query, [url, output_file_size, file_unit, key], async (err, result) => {
                        if (err) {
                            console.log(err);
                            res.status(400).json({ msg: "Failed to upload video!" });
                        } else {
                            console.log("Video processed successfully");
                            res.status(200).json({ msg: "Video uploaded successfully", url: url, size: output_file_size, unit: file_unit });
                        }
                    });
                }
            });
        }
    });
};

app.post('/api/v1/transcoder', async (req, res) => {
    const { bucket, key, width, height } = req.body;
    const download_params = {
        Bucket: bucket,
        Key: key,
    };
    try {
        const data = await s3.getObject(download_params).promise();
        const downloadPath = path.join(__dirname, `downloads/${key}.mp4`);
        const outputPath = path.join(__dirname, `outputs/${key}_resized.mp4`);
        await writeFileAsync(downloadPath, data.Body);
        await resizeVideo(downloadPath, outputPath, width, height);
        await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: key, status: 2 });
        await uploadToS3(res, outputPath, key);
        await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: key, status: 3 });
    } catch (err) {
        console.log(err);
        res.status(403).json({ msg: "Something went wrong!" });
    }
});

app.listen(6876)
