exports.handler = async (event) => {
  console.log("Hello from Docker Lambda! 11111");
  return { statusCode: 200, body: "OK from Docker" };
};
