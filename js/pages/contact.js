import "../app.js";
import { api, toast, state, onAuth } from "../app.js";

const form = document.getElementById("contact-form");
const openedAt = Date.now();

onAuth((user) => {
  if (!user || !form) return;
  if (!form.email.value && user.email) form.email.value = user.email;
  if (!form.name.value && (state.profile?.displayName || user.displayName)) form.name.value = state.profile?.displayName || user.displayName;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]");
  const hint = form.querySelector("[data-status]");
  button.disabled = true;
  hint.textContent = "Enviando...";
  try {
    await api("contact", {
      name: form.name.value,
      email: form.email.value,
      subject: form.subject.value,
      message: form.message.value,
      website: form.website.value,
      elapsed: Date.now() - openedAt,
    });
    form.reset();
    hint.textContent = "Mensagem enviada! Respondemos pelo e-mail que você informou.";
    toast("Mensagem enviada. Obrigado!");
  } catch (error) {
    hint.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
