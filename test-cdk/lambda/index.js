exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from bundled Lambda!',
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(2, 15),
    }),
  };

  return response;
};
