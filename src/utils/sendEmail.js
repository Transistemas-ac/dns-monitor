export default async function sendEmail(env, subject, body) {
  const apiKey = env.RESEND_API_KEY;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error al enviar correo:", res.status, text);
    throw new Error(`Error al enviar correo: ${res.status}`);
  }
}
