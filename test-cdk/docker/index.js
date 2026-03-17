exports.handler = async (_event) => {
  console.log("Hello from Docker Lambda!");
  return { statusCode: 200, body: "OK from Docker" };
};
