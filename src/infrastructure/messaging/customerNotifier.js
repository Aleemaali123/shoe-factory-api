const channels = new Set(['whatsapp', 'sms', 'both']);

export function createCustomerNotifier({
  channel = 'both',
  accountSid = '',
  authToken = '',
  smsFrom = '',
  whatsappFrom = '',
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const selected = channels.has(channel) ? channel : 'both';

  return {
    async orderConfirmed(order) {
      const phone = toE164(order.contactPhone);
      const text = confirmationText(order);
      if (!phone) {
        logger.warn('[notify] skipped order confirmation: phone is not a 10-digit mobile');
        return 'Order confirmed. Add a 10-digit mobile number to receive WhatsApp or text updates.';
      }

      const wanted = wantedChannels(selected);
      if (!accountSid || !authToken) {
        logger.info(`[notify] ${wanted.join(' + ')} not sent (Twilio is not configured). ${phone}: ${text}`);
        return `Order confirmed. Connect WhatsApp or SMS in the server settings to deliver this message to ${maskPhone(phone)}.`;
      }

      const jobs = [];
      if (wanted.includes('whatsapp')) {
        jobs.push(deliver({
          name: 'whatsapp',
          from: whatsappAddress(whatsappFrom),
          to: `whatsapp:${phone}`,
          body: text,
          missing: 'TWILIO_WHATSAPP_FROM',
        }));
      }
      if (wanted.includes('sms')) {
        jobs.push(deliver({
          name: 'sms',
          from: String(smsFrom || '').trim(),
          to: phone,
          body: text,
          missing: 'TWILIO_SMS_FROM',
        }));
      }

      const results = await Promise.all(jobs);
      const sent = results.filter((item) => item.ok).map((item) => item.name);
      const failed = results.filter((item) => !item.ok);

      for (const item of failed) {
        logger.error(`[notify] ${item.name} failed for ${phone}: ${item.reason}`);
      }
      if (sent.length) {
        logger.info(`[notify] ${sent.join(' + ')} sent to ${phone} for ${order.id}`);
      }
      return summary(phone, sent, failed.map((item) => item.name));
    },
  };

  function deliver({ name, from, to, body, missing }) {
    if (!from) {
      return Promise.resolve({ name, ok: false, reason: `${missing} is empty` });
    }
    return sendTwilio({
      accountSid,
      authToken,
      from,
      to,
      body,
      fetchImpl,
    }).then(
      () => ({ name, ok: true }),
      (error) => ({ name, ok: false, reason: error.message }),
    );
  }
}

export function confirmationText(order) {
  const total = formatRupees(order.total);
  const paid = order.paymentMethod === 'razorpay' && String(order.paymentReference ?? '').trim();
  if (paid) {
    return `Shoe Factory: Payment received. Order ${order.id} is confirmed for ${total}. We will start packing it now.`;
  }
  return `Shoe Factory: Order ${order.id} is confirmed for ${total}. Pay on delivery. We will start packing it now.`;
}

export function toE164(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) return '';
  return `+91${local}`;
}

function wantedChannels(channel) {
  if (channel === 'both') return ['whatsapp', 'sms'];
  return [channel];
}

function whatsappAddress(value) {
  const from = String(value ?? '').trim();
  if (!from) return '';
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
}

function maskPhone(phone) {
  return `${phone.slice(0, 3)}••••${phone.slice(-4)}`;
}

function summary(phone, sent, failed) {
  const masked = maskPhone(phone);
  const label = {
    whatsapp: 'WhatsApp',
    sms: 'text message',
  };
  if (sent.length === 1 && failed.length === 0) {
    return `Confirmation sent to ${masked} on ${label[sent[0]]}.`;
  }
  if (sent.length === 2) {
    return `Confirmation sent to ${masked} on WhatsApp and by text message.`;
  }
  if (sent.length === 1) {
    return `Confirmation sent to ${masked} on ${label[sent[0]]}. The other channel could not be reached.`;
  }
  return `Order confirmed. We could not send WhatsApp or a text message to ${masked}.`;
}

function formatRupees(amount) {
  const value = Math.round(Number(amount) || 0);
  return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
}

async function sendTwilio({ accountSid, authToken, from, to, body, fetchImpl }) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  if (response.ok) return;
  const detail = await response.text();
  throw new Error(`Twilio returned ${response.status}: ${detail.slice(0, 300)}`);
}
