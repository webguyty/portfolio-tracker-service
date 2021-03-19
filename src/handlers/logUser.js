import AWS from "aws-sdk";
const iplocate = require("node-iplocate");
var zipcodes = require("zipcodes");

import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpEventNormalizer from "@middy/http-event-normalizer";
import httpErrorHandler from "@middy/http-error-handler";
import createHttpError from "http-errors";
import cors from "@middy/http-cors";

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function logUser(event, context) {
  // Get user IP address and only take first value
  let ip = event.headers["X-Forwarded-For"];
  ip = ip.split(",");
  ip = ip[0];

  // Set first visit date
  const now = new Date();
  const visit = now.toISOString();

  // Get user location
  let location = {};
  const ipResult = await iplocate(ip);
  location = {
    city: ipResult.city,
    country: ipResult.country,
    zip: ipResult.postal_code,
  };

  // Get state location from zip code
  const zipResults = zipcodes.lookup(location.zip);
  location.state = zipResults.state;

  const user = {
    ip,
    location,
    visits: [visit],
  };

  try {
    const params = {
      TableName: process.env.PORTFOLIO_TRACKER_TABLE_NAME,
      Key: { ip: user.ip },
      UpdateExpression:
        "SET #ul = :userLocation, #v = list_append(if_not_exists(#v, :create_list), :visits)",
      ExpressionAttributeNames: {
        "#ul": "userLocation",
        "#v": "visits",
      },
      ExpressionAttributeValues: {
        ":userLocation": user.location,
        ":visits": [visit],
        ":create_list": [],
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
      body: JSON.stringify(result.Attributes),
    };
  } catch (error) {
    console.error(error);
    throw new createHttpError.InternalServerError(error);
  }
}

export const handler = middy(logUser)
  .use(httpJsonBodyParser())
  .use(httpEventNormalizer())
  .use(httpErrorHandler())
  .use(cors());
