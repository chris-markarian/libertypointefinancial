// lead-notify.js
// Triggered when Netlify Forms receives a new contact form submission
// Sends instant SMS to the lead + email notification to Chris

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

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'Liberty Pointe Financial <noreply@libertypointefinancial.com>',
      to: [to],
      subject,
      html
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse Netlify Forms payload
    const payload = JSON.parse(event.body);
    const data = payload.payload?.data || {};

    const firstName = data.firstName || data['first-name'] || data.name || 'there';
    const lastName = data.lastName || data['last-name'] || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const phone = (data.phone || data.Phone || '').replace(/\D/g, '');
    const email = data.email || data.Email || '';
    const interest = data.interest || data.Interest || 'your inquiry';
    const message = data.message || data.Message || '';

    const results = { sms: null, email: null };

    // --- SMS to lead ---
    if (phone && phone.length >= 10) {
      const e164 = phone.startsWith('1') ? `+${phone}` : `+1${phone}`;
      const smsBody = `Hi ${firstName}! This is Chris at Liberty Pointe Financial — thanks for reaching out about ${interest}. I'd love to connect. Grab a free 30-min slot here: ${CALENDLY} — no pressure at all. Reply STOP to opt out.`;
      try {
        results.sms = await sendSMS(e164, smsBody);
        console.log('SMS sent to lead:', e164);
      } catch(e) {
        console.error('SMS to lead failed:', e.message);
        results.sms = { error: e.message };
      }
    }

    // --- Email notification to Chris ---
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2A4A;padding:24px;border-radius:8px 8px 0 0;">
          <h2 style="color:#C9A84C;margin:0;">🔔 New Lead from Website</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
          <p><strong>Name:</strong> ${fullName}</p>
          ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>` : ''}
          ${phone ? `<p><strong>Phone:</strong> <a href="tel:+1${phone}">${phone}</a></p>` : ''}
          <p><strong>Interest:</strong> ${interest}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;" />
          <p style="color:#666;font-size:0.9rem;">
            ${phone ? '✅ Instant SMS sent to lead.' : '⚠️ No phone number — SMS not sent.'}<br/>
            Submitted via libertypointefinancial.com contact form.
          </p>
          ${email ? `<a href="mailto:${email}" style="display:inline-block;background:#C9A84C;color:#1B2A4A;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">Reply to ${firstName}</a>` : ''}
        </div>
      </div>
    `;

    try {
      results.email = await sendEmail(
        NOTIFY_EMAIL,
        `New Lead: ${fullName} — ${interest}`,
        emailHtml
      );
      console.log('Notification email sent to Chris');
    } catch(e) {
      console.error('Email notification failed:', e.message);
      results.email = { error: e.message };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, results })
    };

  } catch(err) {
    console.error('lead-notify error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
