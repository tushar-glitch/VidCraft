// [AWS DISABLED] AWS (S3/SQS) is no longer used in VidCraft. Lines prefixed with "// [AWS] " are kept only for reference.

const mime = require('mime-types')
const fs = require('fs')
// [AWS] const AWS = require('aws-sdk')
const { getVideoDurationInSeconds } = require('get-video-duration')
const client = require('../db/conn')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')


// [AWS] const s3 = new AWS.S3({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY
// [AWS] })
// [AWS] 
// [AWS] const sqs = new AWS.SQS({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY,
// [AWS]     region: process.env.AWS_REGION
// [AWS] });
// [AWS] 
// [AWS] // Push video details to SQS
// [AWS] const push_to_sqs = async (req, res, result) => {
// [AWS]     console.log('Pushing to SQS started...');
// [AWS]     console.log("Key while pushing to sqs", req.file.filename);
// [AWS]     const sqsParams = {
// [AWS]         MessageBody: JSON.stringify({
// [AWS]             bucket: process.env.AWS_BUCKET_NAME,
// [AWS]             key: req.file.filename,
// [AWS]             videoId: result.rows[0].id
// [AWS]         }),
// [AWS]         QueueUrl: process.env.SQS_QUEUE_URL
// [AWS]     };
// [AWS] 
// [AWS]     sqs.sendMessage(sqsParams, (err, data) => {
// [AWS]         if (err) {
// [AWS]             console.log(err);
// [AWS]             // res.status(400).json({ msg: "Failed to push video details to SQS" });
// [AWS]         } else {
// [AWS]             console.log("Video details pushed to SQS", data);
// [AWS]             // res.status(200).json({ msg: "Video uploaded successfully" });
// [AWS]         }
// [AWS]     });
// [AWS] }

// Upload video to S3
exports.uploadVideo = async (req, res) => {
    const { service } = req.body
    const req_width = req.body.req_width, req_height = req.body.req_height, output_video_format = req.body.output_video_format;
    const compression_ratio = req.body.compression_ratio
    
    const file_key = req.file.filename
    const file_size = req.file.size / 1024 / 1024 / 1024
    
    if (file_size > req.max_video_size) {
        return res.status(400).json({ msg: "File size is too large" })
    }
    
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
// [AWS]         s3.upload(params, async (err, data) => {
// [AWS]             if (err) console.log(err);
// [AWS]             else {
// [AWS]                 const urlParams = {
// [AWS]                     Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]                     Key: req.file.filename,
// [AWS]                     Expires: 8 * 60 * 60, // 8 hour
// [AWS]                     ResponseContentDisposition: `attachment; filename="${file_key}.mp4"`,
// [AWS]                     ResponseContentType: 'video/mp4'
// [AWS]                     // ResponseContentType: fileMime
// [AWS]                 };
// [AWS]                 s3.getSignedUrl('getObject', urlParams, async (err, url) => {
// [AWS]                     if (err) console.log(err);
// [AWS]                     else {
// [AWS]                         const stream = fs.createReadStream(filePath)
// [AWS]                         const duration = await getVideoDurationInSeconds(stream)
// [AWS]                         const video_name = req.file.originalname
// [AWS]                         //video - id, name, session_id, user_id, duration, url
// [AWS] 
// [AWS]                         const query = 'INSERT INTO video (name, session_id, url, duration, user_id, service, file_key_name, req_width, req_height, output_video_format, compression_ratio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *'
// [AWS]                         client.query(query, [video_name, req.session_token, url, duration, req.user_id, service, file_key, req_width, req_height, output_video_format, compression_ratio], async (err, result) => {
// [AWS]                             if (err) {
// [AWS]                                 console.log(err)
// [AWS]                                 res.status(400).json({ msg: "Failed to upload video!" })
// [AWS]                             }
// [AWS]                             else {
// [AWS]                                 await push_to_sqs(req, res, result);
// [AWS]                             }
// [AWS]                         })
// [AWS]                     }
// [AWS]                 })
// [AWS]                 console.log("File uploaded successfully!");
// [AWS]                 await axios.post(`${process.env.backend_endpoint}changestatus`, { video_id: file_key, status: 1 });
// [AWS]                 // fs.unlink(filePath, (err) => {
// [AWS]                 //     if (err) console.log(err);
// [AWS]                 // })
// [AWS]             }
// [AWS]         })
    }
    else {
        res.status(400).json({ msg: "Service not found" });
    }
}

// [AWS] const start_multipart_upload = async (file_key) => {
// [AWS]     console.log(file_key);
// [AWS]     
// [AWS]     const params = {
// [AWS]         Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]         Key: file_key,
// [AWS]         ContentDisposition: "inline",
// [AWS]         ContentType: 'video/mp4'
// [AWS]     }
// [AWS]     try {
// [AWS]         const data = await s3.createMultipartUpload(params).promise()
// [AWS]         return data;
// [AWS]     }
// [AWS]     catch (err) {
// [AWS]         console.log(err);
// [AWS]         
// [AWS]         console.log("Error initiating the multipart upload")
// [AWS]         return err
// [AWS]     }
// [AWS] }
// [AWS] 
// [AWS] const generate_presigned_url = async (UploadId, file_key, number_of_chunks) => {
// [AWS]     const part_number = Array.from({ length: number_of_chunks }, (_, i) => i + 1)
// [AWS]     
// [AWS]     const presignedUrls = await Promise.all(
// [AWS]         part_number.map(async (partNumber) => {
// [AWS]             const params = {
// [AWS]                 Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]                 Key: file_key,
// [AWS]                 PartNumber: partNumber,
// [AWS]                 UploadId: UploadId,
// [AWS]                 Expires: 3600 * 3,
// [AWS]             };
// [AWS] 
// [AWS]             return s3.getSignedUrl("uploadPart", {
// [AWS]                 ...params,
// [AWS]             });
// [AWS]         })
// [AWS]     );
// [AWS]     return presignedUrls
// [AWS] }

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