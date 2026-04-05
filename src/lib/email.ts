async function send(to: string, subject: string, html: string) {
  const apiKey = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_SECRET_KEY;
  if (!apiKey || !secret) throw new Error("Mailjet credentials are not set");

  const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");

  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: "noreply@price-vault.com", Name: "Pricevault" },
          To: [{ Email: to }],
          Subject: subject,
          HTMLPart: html,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mailjet error ${res.status}: ${body}`);
  }
}

export async function sendPaymentFailedEmail(to: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: monospace; background: #fff; color: #111; padding: 40px 24px; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 24px;">Pricevault</p>
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Payment failed</h1>
  <p style="font-size: 14px; color: #444; margin: 0 0 28px; line-height: 1.6;">
    We couldn't process your last payment. Update your billing details to keep access to Pricevault.
  </p>
  <a href="https://price-vault.com/account" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 12px 24px;">
    Update billing
  </a>
  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.6;">
    If you have questions, reply to this email.
  </p>
</body>
</html>`;

  await send(to, "Action required: payment failed", html);
}

export async function sendCancellationEmail(to: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: monospace; background: #fff; color: #111; padding: 40px 24px; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 24px;">Pricevault</p>
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Subscription cancelled</h1>
  <p style="font-size: 14px; color: #444; margin: 0 0 28px; line-height: 1.6;">
    Your Pricevault subscription has been cancelled. You won't be charged again. If you change your mind, you're welcome back anytime.
  </p>
  <a href="https://price-vault.com/pricing" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 12px 24px;">
    Resubscribe
  </a>
  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.6;">
    Questions? Reply to this email anytime.
  </p>
</body>
</html>`;

  await send(to, "Your subscription has been cancelled", html);
}

export async function sendWelcomeEmail(to: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: monospace; background: #fff; color: #111; padding: 40px 24px; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 24px;">Pricevault</p>
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">You're in.</h1>
  <p style="font-size: 14px; color: #444; margin: 0 0 20px; line-height: 1.6;">
    Your subscription is active. Head to the platform and start using the terminal.
  </p>
  <a href="https://price-vault.com/app" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 12px 24px;">
    Open Pricevault
  </a>
  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.6;">
    Questions? Reply to this email anytime.
  </p>
</body>
</html>`;

  await send(to, "Welcome to Pricevault", html);
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: monospace; background: #fff; color: #111; padding: 40px 24px; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 24px;">Pricevault</p>
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Verify your email</h1>
  <p style="font-size: 14px; color: #444; margin: 0 0 28px; line-height: 1.6;">
    Click below to verify your email address. The link expires in <strong>24 hours</strong>.
  </p>
  <a href="${verifyUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 12px 24px;">
    Verify email
  </a>
  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.6;">
    If you didn't create a Pricevault account, ignore this email.
  </p>
</body>
</html>`;

  await send(to, "Verify your email", html);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: monospace; background: #fff; color: #111; padding: 40px 24px; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 24px;">Pricevault</p>
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Password reset</h1>
  <p style="font-size: 14px; color: #444; margin: 0 0 28px; line-height: 1.6;">
    We received a request to reset your password. Click the button below — the link expires in <strong>1 hour</strong>.
  </p>
  <a href="${resetUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 12px 24px;">
    Reset password
  </a>
  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.6;">
    If you didn't request this, ignore this email — your password won't change.<br>
    <span style="word-break: break-all;">${resetUrl}</span>
  </p>
</body>
</html>`;

  await send(to, "Reset your password", html);
}
