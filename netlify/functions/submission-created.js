// submission-created.js
// Netlify automatically triggers functions named "submission-created" on every form submission
// This sends instant SMS to the lead + email notification to Chris

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
const RESEND_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = 'info@libertypointefinancial.com';
const CALENDLY = 'https://calendly.com/chris-libertypointefinancial/30min';

async function sendSMS(to, body) {
  const creds = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio error: ${data.message}`);
  return data;
}

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'Liberty Pointe Leads <noreply@libertypointefinancial.com>',
      to: [NOTIFY_EMAIL],
      subject,
      html
    })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
  }
}

exports.handler = async function(event) {
  try {
    const payload = JSON.parse(event.body);
    const data = payload.payload?.data || {};

    const firstName = data.firstName || data['first-name'] || data.name || 'there';
    const lastName = data.lastName || data['last-name'] || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const rawPhone = (data.phone || data.Phone || '').replace(/\D/g, '');
    const email = data.email || data.Email || '';
    const interest = data.interest || data.Interest || 'your inquiry';
    const message = data.message || data.Message || '';

    console.log('Form submission received:', { fullName, rawPhone, email, interest });

    // --- SMS to lead ---
    if (rawPhone && rawPhone.length >= 10) {
      const e164 = rawPhone.startsWith('1') ? `+${rawPhone}` : `+1${rawPhone}`;
      const smsBody = `Hi ${firstName}! This is Chris at Liberty Pointe Financial — thanks for reaching out! I'd love to connect. Grab a free 30-min consultation here: ${CALENDLY} — no pressure at all. Reply STOP to opt out.`;
      try {
        await sendSMS(e164, smsBody);
        console.log('SMS sent to:', e164);
      } catch(e) {
        console.error('SMS failed:', e.message);
      }
    } else {
      console.log('No valid phone number found, skipping SMS');
    }

    // --- Email to Chris ---
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2A4A;padding:24px;border-radius:8px 8px 0 0;">
          <h2 style="color:#C9A84C;margin:0;">🔔 New Lead from Website</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
          <p><strong>Name:</strong> ${fullName}</p>
          ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>` : ''}
          ${rawPhone ? `<p><strong>Phone:</strong> ${rawPhone}</p>` : '<p><strong>Phone:</strong> Not provided</p>'}
          <p><strong>Interest:</strong> ${interest}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;" />
          <p style="color:#666;font-size:0.9rem;">
            ${rawPhone ? '✅ Instant SMS sent to lead.' : '⚠️ No phone — SMS not sent.'}<br/>
            Submitted via libertypointefinancial.com
          </p>
          ${email ? `<a href="mailto:${email}" style="display:inline-block;background:#C9A84C;color:#1B2A4A;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">Reply to ${firstName}</a>` : ''}
        </div>
      </div>`;

    await sendEmail(`New Lead: ${fullName} — ${interest}`, emailHtml);
    console.log('Notification email sent');

    return { statusCode: 200, body: 'OK' };
  } catch(err) {
    console.error('submission-created error:', err);
    return { statusCode: 500, body: err.message };
  }
};
