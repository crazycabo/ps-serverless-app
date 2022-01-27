/*

  Pluralsight Serverless Development Path (https://tuck.cc/serverlessDev)
  Author: David Tucker (davidtucker.net)

  ---

  AWS Clients

  This file exports functions to create each of the AWS clients that will
  be used throughout this application.  By having all of these in one
  location, it will be easier to implement tracing for AWS service calls.

*/
import * as AWS from 'aws-sdk';
import AWSXRay from 'aws-xray-sdk';

let _dynamoDB;

/**
 * Creates the DynamoDB client for use in the application.
 *
 * @returns {object} DynamoDB Client
 */
const dynamoDB = () => {
  if (!_dynamoDB) {
    _dynamoDB = new AWS.DynamoDB.DocumentClient();
    AWSXRay.captureAWSClient(_dynamoDB.service);
  }
  return _dynamoDB;
};

let _s3;

/**
 * Create Amazon S3 client for use in the application.
 *
 * @returns {object} Amazon S3 client
 */
const s3 = () => {
  if (!_s3) {
    _s3 = AWSXRay.captureAWSClient(new AWS.S3());
  }

  return _s3;
};

let _textract;

/**
 * Create Textract client for use in the application.
 *
 * @returns {object} Textract client
 */
const textract = () => {
  if (!_textract) {
    _textract = AWSXRay.captureAWSClient(new AWS.Textract());
  }

  return _textract;
};

let _ses;

/**
 * Create Simple Email Service (SES) client for use in the application.
 *
 * @returns {object} Simple Email Service client
 */
const ses = () => {
  if (!_ses) {
    _ses = AWSXRay.captureAWSClient(new AWS.SES());
  }

  return _ses;
};

let _eventBridge;

/**
 * Create EventBridge client for use in the application.
 *
 * @returns {object} EventBridge client
 */
const eventBridge = () => {
  if (!_eventBridge) {
    _eventBridge = AWSXRay.captureAWSClient(new AWS.EventBridge());
  }

  return _eventBridge;
};

let _cisp;

/**
 * Creates the Cognito Identity Service Provider client for use in the application.
 *
 * @returns {object} Cognito Identity Service Provider Client
 */
const cisp = () => {
  if (!_cisp) {
    _cisp = AWSXRay.captureAWSClient(new AWS.CognitoIdentityServiceProvider());
  }
  return _cisp;
};

export const AWSClients = {
  dynamoDB,
  s3,
  textract,
  ses,
  eventBridge,
  cisp,
};
