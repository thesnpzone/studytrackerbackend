const resetPasswordEmailTemplate = (resetToken) => `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            color: #333;
            padding: 20px;
        }
        
        .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
            color: #4CAF50;
        }
        
        a {
            color: white !important;
        }
        
        .reset-link {
            display: inline-block;
            font-size: 18px;
            color: #fff;
            background-color: #4CAF50;
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            margin-top: 10px;
            transition: background-color 0.3s ease;
        }
        
        .reset-link:hover {
            background-color: #2f6930;
        }
    </style>
</head>

<body>
    <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the button below to reset your password:</p>
        <a class="reset-link" href="http://localhost:3000/reset-password/${resetToken}">Reset Your Password</a>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Thank you!</p>
    </div>
</body>

</html>
`;
module.exports = resetPasswordEmailTemplate;