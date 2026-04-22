export function sendEmail(executionInput) {
  console.log("EMAIL SENT:");
  console.log({
    to: executionInput.target,
    subject: executionInput.parameters.subject,
    body: executionInput.parameters.body
  });

  return {
    status: "SENT",
    timestamp: new Date().toISOString()
  };
}
