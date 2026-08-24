export default async function sendEmail({ apiKey, from, to, subject, text, html }) {
  if (!apiKey) {
    throw new Error("No hay API key de Resend configurada para este dominio");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error al enviar correo:", res.status, text);
    throw new Error(`Error al enviar correo: ${res.status}`);
  }
}