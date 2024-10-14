const registrationNotificationTemplate = (fullName, email) => {
    return `
         <div>
      <h1>New Registration Alert!</h1>
      <p>A new user/admin has registered on your application:</p>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
    </div>
    `;
};

module.exports = registrationNotificationTemplate;