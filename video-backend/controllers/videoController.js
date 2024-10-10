
const mime = require('mime-types')
const fs = require('fs')
const AWS = require('aws-sdk')
const { getVideoDurationInSeconds } = require('get-video-duration')
const client = require('../db/conn')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')


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
    const req_width = req.body.req_width, req_height = req.body.req_height, output_video_format = req.body.output_video_format;
    const compression_ratio = req.body.compression_ratio
    
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

                        const query = 'INSERT INTO video (name, session_id, url, duration, user_id, service, file_key_name, req_width, req_height, output_video_format, compression_ratio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *'
                        client.query(query, [video_name, req.session_token, url, duration, req.user_id, service, file_key, req_width, req_height, output_video_format, compression_ratio], async (err, result) => {
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

const start_multipart_upload = async (file_key) => {
    console.log(file_key);
    
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: file_key,
        ContentDisposition: "inline",
        ContentType: 'video/mp4'
    }
    try {
        const data = await s3.createMultipartUpload(params).promise()
        return data;
    }
    catch (err) {
        console.log(err);
        
        console.log("Error initiating the multipart upload")
        return err
    }
}

const generate_presigned_url = async (UploadId, file_key, number_of_chunks) => {
    const part_number = Array.from({ length: number_of_chunks }, (_, i) => i + 1)
    
    const presignedUrls = await Promise.all(
        part_number.map(async (partNumber) => {
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: file_key,
                PartNumber: partNumber,
                UploadId: UploadId,
                Expires: 3600 * 3,
            };

            return s3.getSignedUrl("uploadPart", {
                ...params,
            });
        })
    );
    return presignedUrls
}

exports.uploadVideo2 = async (req, res) => {
    const { service, number_of_chunks } = req.body
    const file_key = uuidv4()
    
    const multi_part_upload_data = await start_multipart_upload(file_key)
    if (service && number_of_chunks){
        if (multi_part_upload_data && multi_part_upload_data.UploadId) {
            const presigned_urls = await generate_presigned_url(multi_part_upload_data.UploadId, file_key, number_of_chunks)
            res.status(200).json(presigned_urls)
        }
        else res.status(400).json({ msg: "Something went wrong!" })
    }
    else {
        res.status(404).json({ msg: "Please provide all the fields" });
    }
}