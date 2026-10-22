// Support The Road (4.39.0, #/support, from More): a thank-you from Louie and a way to chip in on Ko-fi.
// Nothing in the app depends on it: everything stays free and nothing unlocks. Payments happen on Ko-fi,
// never in the app. At App Store launch the Ko-fi link gives way to an in-app tip jar (Apple asks for
// in-app purchase for tips), so the link lives in one place: SUPPORT_URL.
import { app, esc, icon, showToCopy, toast } from "./ui.js";
import { go } from "./app.js";
import { louie } from "./louie.js";

export const SUPPORT_URL = "https://ko-fi.com/theroadapp";
const APP_URL = "https://grahamdeno.github.io/tabs/";

export function renderSupport() {
  app.innerHTML = `<div class="sp">
    <div class="head"><button class="ib glass" id="back" aria-label="Back">${icon("back")}</button></div>
    <div class="sp-hero">${louie("cheer", { pose: "thumb", size: 150 })}</div>
    <h1 class="sp-h">Support The Road</h1>
    <p class="sp-p">The Road is free, with no ads and nothing locked, and it's made by one person. If it helps your playing, you can chip in toward the time it takes to build.</p>
    <p class="sp-p">It changes nothing in the app. Everything stays free either way.</p>
    <div class="sp-acts">
      <a class="btn primary sp-go" id="sp-kofi" href="${esc(SUPPORT_URL)}" target="_blank" rel="noopener">${icon("heart")}Support on Ko-fi</a>
      <button class="btn sp-share" id="sp-share">${icon("share")}Tell a friend about it</button>
    </div>
    <p class="foot sp-foot">Ko-fi takes a card, Apple Pay or PayPal, with no account needed. The payment happens on Ko-fi, never in the app.</p>
  </div>`;
  document.getElementById("back").onclick = () => history.length > 1 ? history.back() : go("#/");
  document.getElementById("sp-kofi").addEventListener("click", () => toast("Thank you. Louie says so too."));
  document.getElementById("sp-share").onclick = async () => {
    const msg = { title: "The Road", text: "A guitar app that turns practice into a tour.", url: APP_URL };
    try { if (navigator.share) return await navigator.share(msg); } catch (e) { if (e?.name === "AbortError") return; }
    showToCopy("Share The Road", APP_URL);
  };
}
