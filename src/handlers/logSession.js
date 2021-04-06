import AWS from 'aws-sdk';
const dynamodb = new AWS.DynamoDB.DocumentClient();

import corsHeaders from '../../utils/corsHeaders';
const cors = corsHeaders();

async function logSession(event, context) {
  console.log(event.body);
  const info = JSON.parse(event.body);
  let { enterTime, exitTime } = info;

  // Find length of time on div
  let enter = new Date(enterTime);
  let exit = new Date(exitTime);
  const sessionTime = (exit - enter) / 1000;

  const sessionArr = [
    {
      enterTime,
      exitTime,
      sessionTime,
    },
  ];
  console.log(sessionArr);
  //
  // Make API call
  //

  // Get user IP address and only take first value for put into table
  let ip = event.headers['X-Forwarded-For'];
  ip = ip.split(',');
  ip = ip[0];

  const params = {
    TableName: process.env.PORTFOLIO_TRACKER_TABLE_NAME,
    Key: { ip },
    UpdateExpression:
      'SET #sessions = list_append(if_not_exists(#sessions, :create_list), :sessionArr)',
    ExpressionAttributeNames: {
      '#sessions': 'sessions',
    },
    ExpressionAttributeValues: {
      ':sessionArr': sessionArr,
      ':create_list': [],
    },
    ReturnValues: 'NONE',
  };

  try {
    const result = await dynamodb.update(params).promise();
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify(sessionArr[0]),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify(error),
    };
  }
}

export const handler = logSession;
