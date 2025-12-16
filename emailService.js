const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendWelcomeEmail = async (to, firstName) => {
  try {
    const info = await transporter.sendMail({
      from: `"PIGO Exchange" <${process.env.EMAIL_FROM}>`,
      to,
      subject: 'Welcome to PIGO Exchange!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #0f766e); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .bonus-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: #f59e0b; color: black; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to PIGO Exchange!</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Thank you for joining PIGO Exchange! We're excited to have you on board.</p>
              
              <div class="bonus-box">
                <h3>🎁 Welcome Bonus!</h3>
                <p>We've credited <strong>$5 USDT</strong> to your account as a welcome gift!</p>
              </div>
              
              <h3>Get Started:</h3>
              <ol>
                <li>Complete your profile verification</li>
                <li>Explore our trading pairs</li>
                <li>Start trading with your bonus</li>
                <li>Refer friends to earn more rewards</li>
              </ol>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://eximcollaboration.com/trade" class="button">Start Trading Now</a>
              </p>
              
              <h3>Need Help?</h3>
              <p>Check out our <a href="https://eximcollaboration.com/help">Help Center</a> or contact our support team.</p>
              
              <div class="footer">
                <p>Happy Trading!</p>
                <p>The PIGO Exchange Team</p>
                <p>© ${new Date().getFullYear()} PIGO Exchange. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Welcome email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

const sendPasswordResetEmail = async (to, resetToken) => {
  try {
    const resetUrl = `https://eximcollaboration.com/reset-password?token=${resetToken}`;
    
    const info = await transporter.sendMail({
      from: `"PIGO Exchange" <${process.env.EMAIL_FROM}>`,
      to,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #0f766e); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #f59e0b; color: black; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .warning { color: #d32f2f; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Password Reset</h2>
            </div>
            <div class="content">
              <p>You requested a password reset for your PIGO Exchange account.</p>
              <p>Click the button below to reset your password:</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
                ${resetUrl}
              </p>
              
              <p class="warning">⚠️ This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
              
              <div class="footer">
                <p>PIGO Exchange Security Team</p>
                <p>© ${new Date().getFullYear()} PIGO Exchange. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

const sendVerificationEmail = async (to, verificationToken) => {
  try {
    const verifyUrl = `https://eximcollaboration.com/verify-email?token=${verificationToken}`;
    
    const info = await transporter.sendMail({
      from: `"PIGO Exchange" <${process.env.EMAIL_FROM}>`,
      to,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #0f766e); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #f59e0b; color: black; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Verify Your Email</h2>
            </div>
            <div class="content">
              <p>Thank you for registering with PIGO Exchange!</p>
              <p>Please verify your email address to complete your registration and unlock all features:</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" class="button">Verify Email Address</a>
              </p>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
                ${verifyUrl}
              </p>
              
              <p>Need help? Contact our support team at <a href="mailto:support@pigoexchange.com">support@pigoexchange.com</a></p>
              
              <div class="footer">
                <p>Welcome to the PIGO Exchange community!</p>
                <p>© ${new Date().getFullYear()} PIGO Exchange. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  transporter,
};