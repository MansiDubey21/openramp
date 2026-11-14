// Contact form → business mailbox (Titan) over SMTP. Credentials come only from environment variables.
import nodemailer from 'nodemailer';
import { z } from 'zod';

const oneLine = (s) => s.replace(/[\r\n]+/g, ' ').trim();

export const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(100),
  email: z.email('Please enter a valid email address.').max(200),
  message: z.string().trim().min(10, 'Please write at least 10 characters.').max(4000),
  website: z.string().max(200).optional().default(''), // honeypot: real people leave this empty
});

let transporter = null;
// Placeholder values copied from .env.example must not count as configured.
const isReal = (v) => Boolean(v) && !/REPLACE_ME|yourdomain\.com/i.test(v);
export function isContactConfigured() {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_TO'].every((k) => isReal(process.env[k]));
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000,
    });
  }
  return transporter;
}

/** @returns {Promise<{ok:true}|{ok:false,status:number,error:string}>} */
export async function sendContactMessage(body) {
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message || 'Invalid input.' };
  const { name, email, message, website } = parsed.data;
  if (website) return { ok: true }; // bot filled the honeypot: pretend success, send nothing
  if (!isContactConfigured()) return { ok: false, status: 503, error: 'The contact form is not configured on this server yet.' };
  try {
    await getTransporter().sendMail({
      from: `"OpenRamp website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO,
      replyTo: { name: oneLine(name), address: email },
      subject: `OpenRamp contact: ${oneLine(name).slice(0, 80)}`,
      text: `Name: ${oneLine(name)}\nEmail: ${email}\n\n${message}`,
    });
    return { ok: true };
  } catch (e) {
    console.error('[contact] SMTP send failed:', e.code || e.name); // no credentials or message content in logs
    return { ok: false, status: 502, error: 'Sorry, the message could not be sent. Please try again later.' };
  }
}
