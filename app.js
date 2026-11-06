"use strict";

const { comps, market } = window.PROPERTY_DATA;
const $ = (id) => document.getElementById(id);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US");
const statuses = { SOLD: "Closed", ACTIVE: "Active", PENDING: "Pending", BACKUP: "Under contract · accepting backups" };
const fmt = (v) => v == null ? "—" : num.format(v);
const price = (v) => v == null ? "—" : usd.format(v);
const date = (v) => v ? new Date(v + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const nav = document.querySelector(".nav");
function selectNav(link) {
  nav.querySelector("[aria-current]")?.removeAttribute("aria-current");
  link.setAttribute("aria-current", "location");
  if (nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft += link.getBoundingClientRect().left - nav.getBoundingClientRect().left -
      (nav.clientWidth - link.clientWidth) / 2;
  }
}
function updateNav() {
  const link = [...nav.querySelectorAll("a")].find((item) => item.hash === location.hash);
  if (link) selectNav(link);
}
window.addEventListener("hashchange", updateNav);
updateNav();

function median(values) {
  const sorted = values.filter((v) => v != null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

let showAll = false;
function renderMarket() {
  const status = $("market-status").value;
  const closed = status === "SOLD";
  const cutoff = new Date(Date.UTC(2026, 10 - Number($("period").value), 5)).toISOString().slice(0, 10);
  $("period").disabled = !closed;
  const listings = market.filter((r) => (r.status === status || (status === "PENDING" && r.status === "BACKUP")) && (!closed || r.date >= cutoff));
  listings.sort((a, b) => closed ? b.date.localeCompare(a.date) : (a.price ?? Infinity) - (b.price ?? Infinity));
  const stats = [
    [closed ? "Closed sales" : statuses[status] + " listings", fmt(listings.length)],
    [closed ? "Median closed price" : "Median asking price", price(median(listings.map((r) => r.price)))],
    ["Median days on market", fmt(median(listings.map((r) => r.dom)))]
  ];
  $("market-stats").replaceChildren(...stats.map(([label, value]) => {
    const group = element("div");
    group.append(element("dt", label), element("dd", value));
    return group;
  }));
  const visible = showAll ? listings : listings.slice(0, 10);
  $("market-rows").replaceChildren(...visible.map((r) => {
    const row = element("tr");
    const head = element("th", r.address);
    head.scope = "row";
    row.append(head, ...[statuses[r.status], price(r.price), date(r.date), fmt(r.ag), fmt(r.dom)].map((v) => element("td", v)));
    return row;
  }));
  if (!visible.length) {
    const row = element("tr"), cell = element("td", "No listings match these filters.");
    cell.colSpan = 6;
    row.append(cell);
    $("market-rows").append(row);
  }
  $("market-more").hidden = listings.length <= 10;
  $("market-more").textContent = showAll ? "Show first 10 listings" : "Show all " + listings.length + " listings";
}
for (const id of ["period", "market-status"]) {
  $(id).addEventListener("change", () => { showAll = false; renderMarket(); });
}
$("market-more").addEventListener("click", () => { showAll = !showAll; renderMarket(); });
renderMarket();

const featured = ["11421 Ebony St", "11392 Ebony St", "11388 Ebony St", "11361 Ebony St", "11326 Ebony St"];
const relevance = (r) => {
  const i = featured.indexOf(r.address);
  return i === -1 ? featured.length : i;
};
const ordered = [...comps].sort((a, b) => relevance(a) - relevance(b));
const gallery = $("gallery");
let galleryComp;
let activePhoto = 0;
const photos = ["cover.jpg", ...Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, "0") + ".jpg")];
const photoPath = (r, name) => "assets/MLS-" + r.id + "/" + name;

function updatePhoto(index) {
  activePhoto = (index + photos.length) % photos.length;
  $("gallery-image").src = photoPath(galleryComp, photos[activePhoto]);
  $("gallery-image").alt = galleryComp.address + " · photo " + (activePhoto + 1);
  $("gallery-count").textContent = "Photo " + (activePhoto + 1) + " of " + photos.length;
  const buttons = $("thumbnails").children;
  for (const button of buttons) button.removeAttribute("aria-current");
  buttons[activePhoto].setAttribute("aria-current", "true");
  const strip = $("thumbnails");
  strip.scrollLeft += buttons[activePhoto].getBoundingClientRect().left -
    strip.getBoundingClientRect().left - (strip.clientWidth - buttons[activePhoto].clientWidth) / 2;
}

function openGallery(comp) {
  galleryComp = comp;
  $("gallery-title").textContent = comp.address;
  $("thumbnails").replaceChildren(...photos.map((name, i) => {
    const button = element("button");
    button.type = "button";
    button.setAttribute("aria-label", "Show photo " + (i + 1));
    const img = element("img");
    img.src = photoPath(comp, name);
    img.alt = "";
    button.append(img);
    button.addEventListener("click", () => updatePhoto(i));
    return button;
  }));
  gallery.showModal();
  updatePhoto(0);
}
$("gallery-close").addEventListener("click", () => gallery.close());
$("prev-photo").addEventListener("click", () => updatePhoto(activePhoto - 1));
$("next-photo").addEventListener("click", () => updatePhoto(activePhoto + 1));
gallery.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    updatePhoto(activePhoto + (event.key === "ArrowLeft" ? -1 : 1));
  }
});

function renderComps() {
  const status = $("comp-status").value;
  const sort = $("comp-sort").value;
  const selected = ordered.filter((r) => status === "ALL" || status === r.status || (status === "PENDING" && r.status === "BACKUP"));
  if (sort === "high") selected.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  if (sort === "low") selected.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (sort === "recent") selected.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  $("comp-grid").replaceChildren(...selected.map((r) => {
    const card = element("article", null, "card");
    const button = element("button", null, "cover-button");
    button.type = "button";
    button.setAttribute("aria-label", "Open photos of " + r.address);
    const img = element("img");
    img.src = photoPath(r, "cover.jpg");
    img.alt = r.address;
    img.loading = "lazy";
    button.append(img, element("span", "View photos", "photo-label"));
    if (r.status === "ACTIVE") {
      button.append(element("span", "Let's go check out the competition!", "competition-ribbon"));
    }
    button.addEventListener("click", () => openGallery(r));
    const body = element("div", null, "card-body");
    body.append(element("span", statuses[r.status], "badge"), element("h3", r.address),
      element("p", price(r.price) + (r.status === "SOLD" ? " closed" : " asking"), "price"));
    if (r.status === "SOLD" && r.date) {
      const closing = element("time", "Closed " + date(r.date), "closing-date");
      closing.dateTime = r.date;
      body.append(closing);
    }
    body.append(element("p", fmt(r.beds) + " beds · " + fmt(r.baths) + " baths · " + (r.ag == null ? "Above-grade area to verify" : fmt(r.ag) + " sq ft above grade"), "fine"),
      element("p", r.note, "fine"),
      element("p", "Listed by " + r.listingAgent + " · " + r.listingOffice, "listing-credit"));
    card.append(button, body);
    return card;
  }));
  if (!selected.length) $("comp-grid").append(element("p", "No selected homes match this status."));
}
$("comp-status").addEventListener("change", renderComps);
$("comp-sort").addEventListener("change", renderComps);
renderComps();

const subject = { address: "11446 Ebony St", beds: 3, baths: 3, ag: 1643, lot: 6600, built: 2003 };
for (const [i, id] of ["compare-a", "compare-b"].entries()) {
  for (const r of ordered) $(id).add(new Option(r.address, r.id));
  $(id).selectedIndex = i;
  $(id).addEventListener("change", renderCompare);
}
function renderCompare() {
  const chosen = [subject, ...["compare-a", "compare-b"].map((id) => comps.find((r) => r.id === $(id).value))];
  const head = element("thead"), hr = element("tr"), body = element("tbody");
  hr.append(...["Feature", ...chosen.map((r) => r.address)].map((v) => {
    const cell = element("th", v);
    cell.scope = "col";
    return cell;
  }));
  head.append(hr);
  const rows = [
    ["Price", (r) => r === subject ? "To be discussed" : price(r.price) + (r.status === "SOLD" ? " closed" : " asking")],
    ["Close date", (r) => date(r.date)],
    ["Beds", (r) => fmt(r.beds)],
    ["Baths", (r) => fmt(r.baths) + (r === subject ? " reported" : "")],
    ["Above-grade sq ft", (r) => fmt(r.ag)],
    ["Total finished sq ft", (r) => r === subject ? "To confirm" : fmt(r.finished)],
    ["Total basement sq ft", (r) => r === subject ? "To confirm" : fmt(r.basement)],
    ["Finished area below grade", (r) => r === subject ? "To confirm" : fmt(r.below)],
    ["Garage spaces", (r) => r === subject ? "To confirm" : fmt(r.garage)],
    ["Lot sq ft", (r) => fmt(r.lot)],
    ["Year built", (r) => r.built ?? "—"]
  ];
  for (const [label, display] of rows) {
    const row = element("tr"), name = element("th", label);
    name.scope = "row";
    row.append(name, ...chosen.map((r) => element("td", display(r))));
    body.append(row);
  }
  const table = $("compare-table");
  table.replaceChildren(table.caption, head, body);
}
renderCompare();

const scenarios = {
  none: [480000, "Assumes no basement."],
  unfinished: [490000, "Assumes about 700 sq ft of unfinished basement."],
  finished: [508000, "Assumes about 700 sq ft of finished basement."]
};
for (const input of document.querySelectorAll("[name=basement]")) {
  input.addEventListener("change", () => {
    const [amount, note] = scenarios[input.value];
    $("estimate").textContent = price(amount);
    $("estimate-note").textContent = note;
  });
}

function renderProceeds() {
  const read = (id) => Math.max(0, $(id).valueAsNumber || 0);
  const gross = read("sale-price");
  const percent = Math.min(100, read("commission"));
  $("proceeds").textContent = price(gross * (1 - percent / 100) - read("costs") - read("payoff"));
}
for (const id of ["sale-price", "commission", "costs", "payoff"]) $(id).addEventListener("input", renderProceeds);
renderProceeds();
