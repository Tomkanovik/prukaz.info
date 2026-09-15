export interface Env {
  ASSETS: { fetch: typeof fetch };
  RESEND_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/send-email') {
      if (request.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Metoda není povolena.' }),
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return handleSendEmail(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSendEmail(request: Request, env: Env): Promise<Response> {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Neplatný JSON tělo požadavku.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Konfigurace serveru není kompletní (chybí API klíč RESEND_API_KEY).' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let to: string[];
    let subject: string;
    let html: string;
    let replyTo: string | undefined;

    if (body.subject && body.html && body.email) {
      // Direct email sending payload ({ email, subject, html })
      to = Array.isArray(body.to) ? body.to : [body.email];
      subject = body.subject;
      html = body.html;
      replyTo = body.reply_to || body.replyTo;
    } else if (body.name && body.email && body.message) {
      // Contact form payload ({ name, email, message })
      to = ['tomkanovik@seznam.cz'];
      replyTo = body.email;
      subject = `Nová zpráva z webu od ${body.name}`;
      const safeMessage = String(body.message).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      const safeName = String(body.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeEmail = String(body.email).replace(/</g, '&lt;').replace(/>/g, '&gt;');

      html = `
        <h2>Nová zpráva z kontaktního formuláře</h2>
        <p><strong>Jméno:</strong> ${safeName}</p>
        <p><strong>E-mail:</strong> ${safeEmail}</p>
        <p><strong>Zpráva:</strong></p>
        <p>${safeMessage}</p>
      `;
    } else {
      return new Response(
        JSON.stringify({ error: 'Chybí povinná pole v požadavku.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Webový formulář <noreply@mg.prukaz.info>',
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    let resData: any;
    try {
      resData = await resendResponse.json();
    } catch {
      resData = null;
    }

    if (resendResponse.ok) {
      return new Response(
        JSON.stringify({ success: true, message: 'E-mail byl úspěšně odeslán.', data: resData }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const errorMessage = resData?.message || resData?.error || 'Chyba při odesílání e-mailu přes Resend API.';
      return new Response(
        JSON.stringify({ error: errorMessage, details: resData }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Interní chyba serveru.', details: error?.message || String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
