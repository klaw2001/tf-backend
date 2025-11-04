import nodemailer from 'nodemailer';
import { brevoCreds } from '../../config/index.js';

/**
 * Create Brevo email transporter
 */
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.HOST,
    port: process.env.MAIL_PORT,
    secure: false, // false for STARTTLS, true for direct SSL/TLS
    requireTLS: true, // Require TLS connection
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.PASSWORD,
    },
  });
};

/**
 * Generate common email HTML template
 * @param {String} heading - Email heading
 * @param {String} recipientName - Recipient name
 * @param {String} content - Main content (HTML)
 * @returns {String} Complete HTML template
 */
const generateEmailTemplate = (heading, recipientName, content) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${heading}</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName},</p>
          ${content}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TalentFlip. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Create mail options object
 * @param {String} from - Sender email
 * @param {String} to - Recipient email
 * @param {String} subject - Email subject
 * @param {String} html - HTML content
 * @param {String} text - Plain text content
 * @returns {Object} Mail options
 */
const createMailOptions = (from, to, subject, html, text) => {
  return {
    from,
    to,
    subject,
    html,
    text,
  };
};

/**
 * Send email using transporter
 * @param {Object} mailOptions - Email options (from, to, subject, html, text)
 * @returns {Promise<Object>} Email send result
 */
const sendEmail = async (mailOptions) => {
  try {
    const transporter = createEmailTransporter();
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${mailOptions.to}:`, result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send a new chat message notification email
 * @param {Object} recipientUser - User object with email and name
 * @param {String} senderName - Name of the message sender
 * @param {String} message - Message content
 * @param {Number} conversationId - Conversation ID
 * @returns {Promise<Object>} Email send result
 */
export const sendChatMessageEmail = async (recipientUser, senderName, message, conversationId) => {
  try {
    const heading = '💬 New Message on TalentFlip';
    const content = `
      <p>You have a new message from <strong>${senderName}</strong>:</p>
      
      <div style="background-color: white; padding: 20px; border-left: 4px solid #4F46E5; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0;">${message}</p>
      </div>
      
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:4000'}/chat/${conversationId}" class="button">
          View Message
        </a>
      </p>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        You're receiving this email because you have an active conversation on TalentFlip.
      </p>
    `;

    const html = generateEmailTemplate(heading, recipientUser.user_full_name, content);
    
    const text = `
      Hi ${recipientUser.user_full_name},
      
      You have a new message from ${senderName}:
      
      "${message}"
      
      View your message at: ${process.env.FRONTEND_URL || 'http://localhost:4000'}/chat/${conversationId}
      
      © ${new Date().getFullYear()} TalentFlip
    `;

    const mailOptions = createMailOptions(
      `"TalentFlip Chat" <noreply@talentflip.ai>`,
      recipientUser.user_email,
      `New message from ${senderName}`,
      html,
      text
    );

    return await sendEmail(mailOptions);
  } catch (error) {
    console.error('Error sending chat message email:', error);
    throw error;
  }
};

/**
 * Send a general notification email
 * @param {String} recipientEmail - Recipient email address
 * @param {String} recipientName - Recipient name
 * @param {String} subject - Email subject
 * @param {String} heading - Email heading
 * @param {String} content - Email content (text or HTML)
 * @param {String} buttonText - Optional button text
 * @param {String} buttonUrl - Optional button URL
 * @returns {Promise<Object>} Email send result
 */
export const sendNotificationEmail = async (recipientEmail, recipientName, subject, heading, content, buttonText = null, buttonUrl = null) => {
  try {
    const buttonHtml = buttonText && buttonUrl 
      ? `<p><a href="${buttonUrl}" class="button">${buttonText}</a></p>` 
      : '';

    const fullContent = `
      ${content}
      ${buttonHtml}
    `;

    const html = generateEmailTemplate(heading, recipientName, fullContent);
    
    const text = `
      Hi ${recipientName},
      
      ${content.replace(/<[^>]*>/g, '')}
      
      ${buttonUrl ? `Visit: ${buttonUrl}` : ''}
      
      © ${new Date().getFullYear()} TalentFlip
    `;

    const mailOptions = createMailOptions(
      `"TalentFlip" <noreply@talentflip.ai>`,
      recipientEmail,
      subject,
      html,
      text
    );

    return await sendEmail(mailOptions);
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw error;
  }
};

export default {
  sendChatMessageEmail,
  sendNotificationEmail,
};
