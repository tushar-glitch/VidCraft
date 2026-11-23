// [AWS DISABLED] AWS (S3/SQS) is no longer used in VidCraft. Lines prefixed with "// [AWS] " are kept only for reference.
// [AWS] const AWS = require('aws-sdk');
const fs = require('fs')
const path = require('path')
const { promisify, formatWithOptions } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const client = require('./db/conn')
const axios = require('axios')
const http = require('http');
require('dotenv').config()

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

const service = {
    1: 'compressor',
    2: 'resizer'
}


// [AWS] const sqs = new AWS.SQS({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY,
// [AWS]     region: process.env.AWS_REGION
// [AWS] });
// [AWS] 
// [AWS] const s3 = new AWS.S3({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY
// [AWS] });
// [AWS] 
// [AWS] const queueUrl = process.env.SQS_QUEUE_URL;
// [AWS] 
// [AWS] const params = {
// [AWS]     QueueUrl: queueUrl,
// [AWS]     MaxNumberOfMessages: 1,
// [AWS]     VisibilityTimeout: 20,
// [AWS]     WaitTimeSeconds: 3
// [AWS] };

const get_service = async (key) => {
    const query = 'SELECT * FROM video where file_key_name = $1';
    try {
        const result = await new Promise((resolve, reject) => {
            client.query(query, [key], (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });

        if (result && result.rows[0]) {
            const service_number = result.rows[0].service;
            if (service_number) {
                const data = service[parseInt(service_number)];
                return data;
            }
        }
    } catch (err) {
        console.log(err);
    }
    return 'no_service_found'; // Default return value if no service found or error occurs
}

// [AWS] const processMessage = async (message) => {
// [AWS]     console.log('Processing started!')
// [AWS]     if (message && message.Body) {
// [AWS]         const body = JSON.parse(message.Body);
// [AWS] 
// [AWS]         const { bucket, key, videoId } = body;
// [AWS] 
// [AWS]         try {
// [AWS]             var forward_to_service = '';
// [AWS]             forward_to_service = await get_service(key)
// [AWS] 
// [AWS]             // call service here
// [AWS]             if (forward_to_service == 'compressor') {
// [AWS]                 // await axios.post(`${process.env.backend_endpoint_compressor}api/v1/compressor`, { bucket, key })
// [AWS]                 await axios.post(`http://compressor:6875/api/v1/compressor`, { bucket, key })
// [AWS]             }
// [AWS]             else if (forward_to_service == 'resizer') {
// [AWS]                 // await axios.post(`${process.env.backend_endpoint_resizer}api/v1/resizer`, {bucket, key})
// [AWS]                 await axios.post(`http://resizer:6876/api/v1/resizer`, { bucket, key })
// [AWS]             }
// [AWS]             else {
// [AWS]                 console.log('Kya kar raha bhai!!');
// [AWS]             }
// [AWS]             // After processing, delete the message from the queue
// [AWS]             const deleteParams = {
// [AWS]                 QueueUrl: queueUrl,
// [AWS]                 ReceiptHandle: message.ReceiptHandle
// [AWS]             };
// [AWS] 
// [AWS]             sqs.deleteMessage(deleteParams, (err, data) => {
// [AWS]                 if (err) {
// [AWS]                     console.error('Error deleting message from SQS', err);
// [AWS]                 } else {
// [AWS]                     console.log('Message deleted', data);
// [AWS]                 }
// [AWS]             });
// [AWS] 
// [AWS]         } catch (error) {
// [AWS]             console.error('Error downloading video from S3', error);
// [AWS]         }
// [AWS]         finally {
// [AWS]             // After processing, delete the message from the queue
// [AWS]             const deleteParams = {
// [AWS]                 QueueUrl: queueUrl,
// [AWS]                 ReceiptHandle: message.ReceiptHandle
// [AWS]             };
// [AWS] 
// [AWS]             sqs.deleteMessage(deleteParams, (err, data) => {
// [AWS]                 if (err) {
// [AWS]                     console.error('Error deleting message from SQS', err);
// [AWS]                 } else {
// [AWS]                     console.log('Message deleted', data);
// [AWS]                 }
// [AWS]             });
// [AWS]         }
// [AWS]     }
// [AWS] };
// [AWS] 
// [AWS] const pollQueue = () => {
// [AWS]     sqs.receiveMessage(params, (err, data) => {
// [AWS]         if (err) {
// [AWS]             console.error('Error receiving message from SQS', err);
// [AWS]         } else if (data.Messages[0]) {
// [AWS]             processMessage(data.Messages[0]);
// [AWS]         } else {
// [AWS]             console.log('No messages to process');
// [AWS]         }
// [AWS]     });
// [AWS] };
// [AWS] 
// [AWS] // Poll the queue at regular intervals
// [AWS] setInterval(pollQueue, 10000); 

const PORT = process.env.PORT || 5500;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Polling worker is running.\n');
});

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});