/**
 * Document Service
 *
 * This is a microservice that is used in the Pluralsight path on Serverless
 * architecture.
 *
 * @author David Tucker <david@mindmill.co>
 */
import * as path from 'path';
import * as url from 'url';
import {
  validatePathVariables,
  validateMultipartFormData,
  parseMultipartFormData,
  createRouter,
  RouterType,
  Matcher,
  enforceGroupMembership,
} from 'lambda-micro';
import { AWSClients, generateID } from '@ps-serverless/services-common';

// Setup S# Client
const s3 = AWSClients.s3();

// Utilize the DynamoDB document client
const dynamoDB = AWSClients.dynamoDB();
const tableName = process.env.DYNAMO_DB_TABLE;

const schemas = {
  idPathVariable: require('./schemas/idPathVariable.json'),
  createDocument: require('./schemas/createDocument.json'),
};

//-------------------------
// UTILITY FUNCTIONS
//-------------------------

/**
 * This function generates bulk writes for DynamoDB. (Deletes all items with the same PK)
 *
 * @param items
 * @returns {*}
 */
const generateDeleteRequestsForItems = items => {
  return items.map(item => {
    return {
      DeleteRequest: {
        Key: {
          PK: item.PK,
          SK: item.SK,
        },
      },
    };
  });
};

const uploadFileToS3 = async (id, formFile) => {
  const params = {
    Bucket: process.env.UPLOAD_BUCKET,
    Key: `${id}.pdf`,
    Body: formFile.content,
    ContentType: formFile.contentType,
  };

  return s3.upload(params).promise();
};

const createSignedS3URL = async unsignedURL => {
  const urlExpirySeconds = 300;
  const parsedURL = url.parse(unsignedURL);
  const filename = path.basename(parsedURL.pathname);
  const params = {
    Bucket: process.env.ASSET_BUCKET,
    Key: filename,
    Expires: urlExpirySeconds,
  };

  return s3.getSignedUrlPromise('getObject', params);
};

//-------------------------
// SERVICE FUNCTIONS
//-------------------------

const getAllDocuments = async (request, response) => {
  const params = {
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'SK = :key ',
    ExpressionAttributeValues: {
      ':key': 'Doc#Marketing',
    },
  };

  const results = await dynamoDB.query(params).promise();

  return response.output(results.Items, 200);
};

// Get a single document based on the path variable.
const getDocument = async (request, response) => {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'PK = :key AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':key': request.pathVariables.id,
      ':prefix': 'Doc',
    },
  };

  const results = await dynamoDB.query(params).promise();
  const document = results.Items[0];

  document.Thumbnail = await createSignedS3URL(document.Thumbnail);
  document.Document = await createSignedS3URL(document.Document);

  return response.output(document, 200);
};

// Delete document and anything attached to it.
const deleteDocument = async (request, response) => {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'PK = :key',
    ExpressionAttributeValues: {
      ':key': request.pathVariables.id,
    },
  };

  const allValues = await dynamoDB.query(params).promise();
  const batchParams = {
    RequestItems: {
      [tableName]: generateDeleteRequestsForItems(allValues.Items),
    },
  };

  await dynamoDB.batchWrite(batchParams).promise();

  return response.output({}, 200);
};

const createDocument = async (request, response) => {
  const file = request.formData.files[0];
  const { fields } = request.formData;
  const fileId = generateID();

  await uploadFileToS3(fileId, file);

  const item = {
    PK: fileId,
    SK: 'Doc#Marketing',
    DateUploaded: new Date().toISOString(),
    FileDetails: {
      encoding: file.encoding,
      contentType: file.contentType,
      fileName: file.fileName,
    },
    Owner: 'fc4cec10-6ae4-435c-98ca-6964382fee77', // Hard-coded until we put users in place
    Name: fields.name,
  };

  // Add tags, if present
  if (fields.tags && fields.tags.length > 0) {
    item.Tags = fields.tags.split(',');
  }

  // Insert into Database
  const params = {
    TableName: tableName,
    Item: item,
    ReturnValues: 'NONE',
  };

  await dynamoDB.put(params).promise();

  return response.output('Document created', 200);
};

//-------------------------
// LAMBDA ROUTER
//-------------------------

/*
  This uses a custom Lambda container that I have created that is very
  similar to what I use for my projects in production (with the only
  exception being that it is JavaScript and not TypeScript). I have
  released this as a npm package, lambda-micro, and you can view it
  at the link below.

  This is similar to what you can do with something like Express, but it
  doesn't have the weight of using Express fully.

  https://github.com/davidtucker/lambda-micro
*/
const router = createRouter(RouterType.HTTP_API_V2);

router.add(Matcher.HttpApiV2('GET', '/documents/'), getAllDocuments);

router.add(
  Matcher.HttpApiV2('GET', '/documents(/:id)'),
  validatePathVariables(schemas.idPathVariable),
  getDocument,
);

router.add(
  Matcher.HttpApiV2('DELETE', '/documents(/:id)'),
  enforceGroupMembership(['admin', 'contributor']),
  validatePathVariables(schemas.idPathVariable),
  deleteDocument,
);

router.add(
  Matcher.HttpApiV2('POST', '/documents/'),
  enforceGroupMembership(['admin', 'contributor']),
  parseMultipartFormData,
  validateMultipartFormData(schemas.createDocument),
  createDocument,
);

exports.handler = async (event, context) => {
  return router.run(event, context);
};
