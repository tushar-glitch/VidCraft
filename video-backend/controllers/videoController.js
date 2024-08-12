
const mime = require('mime-types')
const fs = require('fs')
const AWS = require('aws-sdk')
const { getVideoDurationInSeconds } = require('get-video-duration')
const client = require('../db/conn')
const axios = require('axios')

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
})

const sqs = new AWS.SQS({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION
});

// Push video details to SQS
const push_to_sqs = async (req, res, result) => {
    console.log('Pushing to SQS started...');
    console.log("Key while pushing to sqs", req.file.filename);
    const sqsParams = {
        MessageBody: JSON.stringify({
            bucket: process.env.AWS_BUCKET_NAME,
            key: req.file.filename,
            videoId: result.rows[0].id
        }),
        QueueUrl: process.env.SQS_QUEUE_URL
    };

    sqs.sendMessage(sqsParams, (err, data) => {
        if (err) {
            console.log(err);
            // res.status(400).json({ msg: "Failed to push video details to SQS" });
        } else {
            console.log("Video details pushed to SQS", data);
            // res.status(200).json({ msg: "Video uploaded successfully" });
        }
    });
}

// Upload video to S3
exports.uploadVideo = async (req, res) => {
    const { service } = req.body
    const file_key = req.file.filename
    if (service) {
        const filePath = `uploads/${req.file.filename}`;
        console.log("File uploading started...");
        const fileMime = mime.lookup(req.file.originalname) || 'application/octet-stream';
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.file.filename,
            Body: fs.createReadStream(filePath),
            // ContentType: fileMime
        }
        res.status(200).json({ file_unique_key: file_key })
        await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: file_key, status: 1 });
        s3.upload(params, async (err, data) => {
            if (err) console.log(err);
            else {
                const urlParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: req.file.filename,
                    Expires: 8 * 60 * 60, // 8 hour
                    ResponseContentDisposition: `attachment; filename="${file_key}.mp4"`,
                    ResponseContentType: 'video/mp4'
                    // ResponseContentType: fileMime
                };
                s3.getSignedUrl('getObject', urlParams, async (err, url) => {
                    if (err) console.log(err);
                    else {
                        const stream = fs.createReadStream(filePath)
                        const duration = await getVideoDurationInSeconds(stream)
                        const video_name = req.file.originalname
                        //video - id, name, session_id, user_id, duration, url

                        const query = 'INSERT INTO video (name, session_id, url, duration, user_id, service, file_key_name) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *'
                        client.query(query, [video_name, req.session_token, url, duration, req.user_id, service, file_key], async (err, result) => {
                            if (err) {
                                console.log(err)
                                res.status(400).json({ msg: "Failed to upload video!" })
                            }
                            else {
                                await push_to_sqs(req, res, result);
                            }
                        })
                    }
                })
                console.log("File uploaded successfully!");
                await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: file_key, status: 1 });
                // fs.unlink(filePath, (err) => {
                //     if (err) console.log(err);
                // })
            }
        })
    }
    else {
        res.status(400).json({ msg: "Service not found" });
    }
}