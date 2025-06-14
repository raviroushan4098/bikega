
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
      console.warn("[CONTACT_API] Form validation failed:", parsedData.error.flatten());
      return NextResponse.json({ error: "Invalid form data.", details: parsedData.error.flatten() }, { status: 400 });
    }

    const { name, email, message } = parsedData.data;

    const { 
      EMAIL_HOST, 
      EMAIL_PORT, 
      EMAIL_USER, 
      EMAIL_PASS, 
      EMAIL_FROM_ADDRESS,
      CONTACT_FORM_RECIPIENT_EMAIL // New environment variable
    } = process.env;

    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
      console.error("[CONTACT_API] Email server configuration is missing in environment variables. Required: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.");
      return NextResponse.json({ error: "Server configuration error. Email cannot be sent at this time." }, { status: 500 });
    }
    
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT, 10),
      secure: parseInt(EMAIL_PORT, 10) === 465, 
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const senderEmail = EMAIL_FROM_ADDRESS || EMAIL_USER;
    const recipientEmail = CONTACT_FORM_RECIPIENT_EMAIL || 'noreply.redditmonitoring@gmail.com';

    if (senderEmail && recipientEmail && senderEmail.toLowerCase() === recipientEmail.toLowerCase()) {
      console.warn(`[CONTACT_API] WARNING: The sender email ('${senderEmail}') and recipient email ('${recipientEmail}') are the same. Emails might not appear as new in the inbox. Check 'Sent Mail' or 'All Mail' folders, or try a different CONTACT_FORM_RECIPIENT_EMAIL for clearer testing.`);
    }

    const mailOptions = {
      from: senderEmail, 
      to: recipientEmail, 
      replyTo: email, 
      subject: `New Contact Form Submission from ${name} - Insight Stream`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
            <h2 style="color: #29ABE2; border-bottom: 2px solid #29ABE2; padding-bottom: 10px;">New Contact Message</h2>
            <p>You have received a new message through the Insight Stream contact form:</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #1a73e8;">${email}</a></p>
            <p><strong>Message:</strong></p>
            <div style="background-color: #ffffff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 5px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.9em; color: #777;">This email was sent from the Insight Stream contact form.</p>
          </div>
        </div>
      `,
    };

    console.log(`[CONTACT_API] Attempting to send email from ${mailOptions.from} to ${mailOptions.to} with subject "${mailOptions.subject}"`);
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[CONTACT_API] Email sent successfully via Nodemailer. Message ID: ${info.messageId}. Accepted by server: ${info.accepted?.join(', ') || 'N/A'}. Rejected by server: ${info.rejected?.join(', ') || 'N/A'}. Full server response: ${info.response}`);
      
      if (info.rejected && info.rejected.length > 0) {
        console.warn(`[CONTACT_API] Email was rejected by the server for some recipients: ${info.rejected.join(', ')}`);
        // Still return success to client as per original logic, but log warning.
      }
      if (info.accepted && info.accepted.length === 0 && mailOptions.to) {
         console.warn(`[CONTACT_API] Email was not explicitly accepted by the server for recipient: ${mailOptions.to}, though no direct error was thrown by sendMail.`);
      }

      return NextResponse.json({ success: true, message: "Message sent successfully!" }, { status: 200 });
    } catch (sendMailError) {
      console.error("[CONTACT_API] Nodemailer transporter.sendMail failed:", sendMailError);
      const errorMessage = sendMailError instanceof Error ? sendMailError.message : "Unknown Nodemailer send error.";
      
      let clientMessage = "Failed to send message due to a server-side email issue.";
      if (errorMessage.includes("Invalid login") || errorMessage.includes("Authentication credentials invalid") || (sendMailError as any)?.responseCode === 535) {
          clientMessage = "Email server authentication failed. Please check server credentials (EMAIL_USER, EMAIL_PASS).";
      } else if (errorMessage.includes("ECONNREFUSED")) {
          clientMessage = "Could not connect to email server. Please check email server host/port (EMAIL_HOST, EMAIL_PORT).";
      } else if ((sendMailError as any)?.code === 'EENVELOPE' || (sendMailError as any)?.responseCode === 550 || (sendMailError as any)?.responseCode === 553) {
          clientMessage = "Email rejected by server (e.g., From/To address issue or spam concern). Check email provider logs.";
      }

      return NextResponse.json({ error: clientMessage, details: errorMessage }, { status: 500 });
    }

  } catch (error) { 
    console.error("[CONTACT_API] General error handling contact form submission (e.g., request parsing):", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while processing the request.";
    return NextResponse.json({ error: "Failed to process request.", details: errorMessage }, { status: 500 });
  }
}
