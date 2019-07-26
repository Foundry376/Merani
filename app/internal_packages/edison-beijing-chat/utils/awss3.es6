var AWS = require('aws-sdk');
let hls3 = require('s3');
const { decryptByAESFile, encryptByAESFile } = require('./aes');
import fs from 'fs';
import uuid from 'uuid';

// import AWS object without services
//var AWS = require('aws-sdk/global');
// Set the region

let s3options = {
  region: "us-east-2",
  accessKeyId: "AKIAJPPBMFBNHSNZ5ELA",
  secretAccessKey: "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",
  Endpoint: "http://s3.us-east-2.amazonaws.com"
}

AWS.config.update(s3options);
// import individual service
//var S3 = require('aws-sdk/clients/s3');
var s3 = new AWS.S3();
//var AWS_ENDPOINT_URL = "http://s3.us-east-2.amazonaws.com";
// 存储桶名称在所有 S3 用户中必须是独一无二的

var path = require('path');
const BUCKET_DEV = 'edison-media-stag';
const BUCKET_PROD = 'edison-media';
const ENCRYPTED_SUFFIX = ".encrypted";

function getMyBucket() {
  if (AppEnv.config.get(`chatProdEnv`)) {
    return BUCKET_PROD;
  } else {
    return BUCKET_DEV;
  }
}

export const downloadFile = (aes, key, name, callback, progressBack) => {
  var params = {
    Bucket: getMyBucket(),
    Key: key
  };
  let request;
  const done = function (err, data) {
    if (err) {
      console.error('fail to down file in message: key, name, err, err.stack: ', key, name, err, err.stack);
      if (callback) {
        callback(err);
      }
    } else {
      console.log( 'finished downloadFile: ', aes, key, name, data.Body.size, data.Body);
      if (aes) {
        data.Body = decryptByAESFile(aes, data.Body);
      }
      fs.writeFileSync(name, data.Body);
      if (callback) {
        callback();
      }
      console.log(`succeed downloadFile aws3 file ${key} to ${name}`);
    }
  }
  request = s3.getObject(params, done);
  request.on('httpDownloadProgress', function (progress) {
    if (progressBack) {
      progressBack(progress);
    }
  });
  return request;
}

export const uploadFile = (oid, aes, file, callback, progressCallback) => {

  let filename = path.basename(file);
  let myKey = oid + '/' + uuid.v4() + path.extname(file);
  let data = fs.readFileSync(file);
  if (aes) {
    data = encryptByAESFile(aes, data);
    myKey = myKey + ENCRYPTED_SUFFIX;
  }
  var uploadParams = { Bucket: getMyBucket(), Key: myKey, Body: data };
  const request = s3.upload(uploadParams);
  request.on('httpUploadProgress', function (progress) {
    if (progressCallback) {
      progressCallback(progress)
    }
    if (+progress.loaded === +progress.total) {
      console.log("Upload Finished. ");
      if (callback) {
        callback(null, filename, myKey, progress.loaded);
      }
    }
  });
  request.send();
  return request;
}

function getSize(len) {
  if (len < 1024) {
    return len + ' B';
  } else if (len < 1024 * 1024) {
    return (len / 1024).toFixed(2) + ' KB';
  }
  else if (len < 1024 * 1024 * 1024) {
    return (len / (1024 * 1024)).toFixed(2) + ' MB';
  } else {
    return (len / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}

