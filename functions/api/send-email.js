export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { name, email, message } = data;

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Všechna pole jsou povinná." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Konfigurace serveru není kompletní (chybí API klíč)." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Webový formulář <noreply@prukaz.info>",
        to: ["tomkanovik@seznam.cz"],
        subject: `Nová zpráva z webu od ${name}`,
        reply_to: email,
        html: `
          <h2>Nová zpráva z kontaktního formuláře</h2>
          <p><strong>Jméno:</strong> ${name}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Zpráva:</strong></p>
          <p>${message.replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    let resData;
    try {
      resData = await response.json();
    } catch {
      resData = null;
    }

    if (response.ok) {
      return new Response(
        JSON.stringify({ success: true, message: "E-mail byl úspěšně odeslán.", data: resData }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      const errorMessage = resData?.message || resData?.error || "Chyba při odesílání e-mailu přes Resend API.";
      return new Response(
        JSON.stringify({ error: errorMessage, details: resData }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Interní chyba serveru.", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
