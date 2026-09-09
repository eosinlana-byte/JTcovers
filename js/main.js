const SAMPLE_COVERS = [
  { title: "The Last Letter", author: "Ella Morgan", genre: "romance", image: "assets/covers/the-last-letter.jpg" },
  { title: "Crown of Embers", author: "S. V. Hale", genre: "fantasy", image: "assets/covers/crown-of-embers.jpg" },
  { title: "Silent Witness", author: "Noah Reed", genre: "thriller", image: "assets/covers/silent-witness.jpg" },
  { title: "After the Rain", author: "Maya Ellison", genre: "contemporary", image: "assets/covers/after-the-rain.jpg" },
  { title: "The Silk Garden", author: "Adeline Croft", genre: "romance", image: "assets/covers/the-silk-garden.jpg" },
  { title: "The Stars We Keep", author: "Lila North", genre: "contemporary", image: "assets/covers/stars-we-keep.jpg" },
  { title: "The Hollow House", author: "Iris Quinn", genre: "mystery", image: "assets/covers/the-hollow-house.jpg" },
  { title: "Velvet Oath", author: "C. R. Vane", genre: "romance", image: "assets/covers/velvet-oath.jpg" }
];

let COVERS = SAMPLE_COVERS.slice();
let usingSamples = true;

const GENRE_LABELS = {
  christian: "Christian",
  romance: "Romance",
  fantasy: "Fantasy",
  horror: "Horror",
  crime: "Crime",
  thriller: "Thriller",
  "self-help": "Self-Help",
  memoir: "Memoir"
};
const genreLabel = (g) => GENRE_LABELS[g] || (g ? g.charAt(0).toUpperCase() + g.slice(1) : "");
const escapeHtml = (s) => String(s || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderCovers(filter = "all") {
  const grid = document.getElementById("portfolioGrid");
  grid.innerHTML = COVERS.map((c, i) => `
    <article class="cover-card${filter !== "all" && c.genre !== filter ? " is-hidden" : ""}" data-index="${i}">
      <div class="cover-card__media">
        <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)} book cover" loading="lazy" />
      </div>
      <div class="cover-card__body">
        <p class="cover-card__genre">${escapeHtml(genreLabel(c.genre))}</p>
        <h3 class="cover-card__title">${escapeHtml(c.title)}</h3>
        <p class="cover-card__author">${escapeHtml(c.author)}</p>
      </div>
    </article>
  `).join("");
}

function renderTestimonials(items) {
  const grid = document.querySelector(".testimonials__grid");
  if (!grid || !items || !items.length) return;
  const sub = document.querySelector("#testimonials .section-sub");
  if (sub) sub.textContent = "Notes from authors I’ve worked with.";
  grid.innerHTML = items.filter((t) => t.image).map((t, i) => `
    <article class="testimonial-card testimonial-card--image">
      <img class="testimonial-card__image" src="${escapeHtml(t.image)}" alt="Client testimonial ${i + 1}" loading="lazy" />
    </article>
  `).join("");
}

function initNav() {
  const nav = document.getElementById("nav");
  const burger = document.getElementById("navBurger");
  const links = document.getElementById("navLinks");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  burger.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    });
  });
}

function initFilters() {
  const filters = document.getElementById("portfolioFilters");
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    filters.querySelectorAll(".filter").forEach((b) => {
      b.classList.toggle("filter--active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    renderCovers(btn.dataset.filter);
  });
}

function initModal() {
  const modal = document.getElementById("coverModal");
  const img = document.getElementById("modalImage");
  const cap = document.getElementById("modalCaption");
  const grid = document.getElementById("portfolioGrid");

  const close = () => {
    modal.classList.remove("is-open");
    img.removeAttribute("src");
  };

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".cover-card");
    if (!card) return;
    const cover = COVERS[Number(card.dataset.index)];
    img.src = cover.image;
    img.alt = cover.title;
    cap.textContent = `${cover.title} - ${cover.author}`;
    modal.classList.add("is-open");
  });

  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });
}

function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

function initForm() {
  const form = document.getElementById("contactForm");
  const note = document.getElementById("formNote");
  const btn = document.getElementById("submitBtn");

  document.querySelectorAll("[data-preselect]").forEach((a) => {
    a.addEventListener("click", () => {
      const select = document.getElementById("service");
      const value = a.getAttribute("data-preselect");
      if ([...select.options].some((o) => o.value === value || o.text === value)) {
        select.value = value;
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.textContent = "";
    note.className = "contact__form-note";

    if (form.website.value) return;

    const fields = ["name", "email", "service", "subject", "message"];
    let ok = true;
    fields.forEach((id) => {
      const el = form[id];
      const valid = el.value && el.value.trim() && (id !== "email" || /.+@.+\..+/.test(el.value));
      el.classList.toggle("invalid", !valid);
      if (!valid) ok = false;
    });

    if (!ok) {
      note.textContent = "Please fill in the required fields.";
      note.classList.add("error");
      return;
    }

    btn.disabled = true;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          service: form.service.value,
          subject: form.subject.value.trim(),
          message: form.message.value.trim(),
          website: form.website.value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Could not send.");
      form.reset();
      note.textContent = "Sent. I’ll get back to you soon.";
      note.classList.add("success");
    } catch (err) {
      note.textContent = err.message || "Could not send. Email joannathompson616@gmail.com.";
      note.classList.add("error");
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadContent() {
  try {
    const res = await fetch("/api/content");
    const data = await res.json();
    if (data.covers && data.covers.length) {
      COVERS = data.covers;
      usingSamples = false;
      const sub = document.querySelector("#portfolio .section-sub");
      if (sub) sub.textContent = "A selection of recent cover work. Click any cover to view it larger.";
      renderCovers();
    }
    if (data.testimonials && data.testimonials.length) {
      renderTestimonials(data.testimonials);
    }
  } catch {
    /* keep samples */
  }
}

renderCovers();
initNav();
initFilters();
initModal();
initReveal();
initForm();
loadContent();
