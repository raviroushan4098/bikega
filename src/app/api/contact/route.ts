
import { type NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as z from 'zod';

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(1, "Message is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedData = contactFormSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: "Invalid form data.", details: parsedData.error.flatten() }, { status: 400 });
    }

    const { name, email, message } = parsedData.data;

    // IMPORTANT: Configure these environment variables in your .env file
    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM_ADDRESS } = process.env;

    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
      console.error("Email server configuration is missing in environment variables.");
      return NextResponse.json({ error: "Server configuration error. Email cannot be sent." }, { status: 500 });
    }
    
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT, 10),
      secure: parseInt(EMAIL_PORT, 10) === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      // If using Gmail and having issues, you might need to enable "Less secure app access"
      // or use an App Password if 2FA is enabled on the sender's Gmail account.
      // For production, a dedicated transactional email service (SendGrid, Mailgun, AWS SES) is recommended.
    });

    const mailOptions = {
      from: EMAIL_FROM_ADDRESS || EMAIL_USER, // Use a configured FROM address or fallback to user
      to: 'noreply.redditmonitoring@gmail.com', // The email address you provided
      replyTo: email, // Set reply-to for easier responses
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #29ABE2;">New Contact Message</h2>
          <p>You have received a new message through the Insight Stream contact form:</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Message:</strong></p>
          <p style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
            ${message.replace(/\n/g, '<br>')}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.9em; color: #777;">This email was sent from the Insight Stream contact form.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: "Message sent successfully!" }, { status: 200 });

  } catch (error) {
    console.error("Error handling contact form submission:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: "Failed to send message.", details: errorMessage }, { status: 500 });
  }
}
