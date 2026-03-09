import nodemailer from 'nodemailer';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export async function sendVerificationEmail(email, code) {
  if (!transporter) {
    console.log(`\n[DEV] Ověřovací kód pro ${email}: ${code}\n`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'BuzzerBros Party <noreply@buzzerbros.app>',
    to: email,
    subject: 'Ověření účtu – BuzzerBros Party',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:2rem">
        <h2 style="color:#6C3CE1">BuzzerBros Party</h2>
        <p>Tvůj ověřovací kód:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.4em;padding:1.5rem;
                    background:#f0ebff;border-radius:12px;text-align:center;color:#4B2AAA">
          ${code}
        </div>
        <p style="color:#888;font-size:0.9em;margin-top:1rem">Kód platí 15 minut.</p>
      </div>
    `,
  });
}
