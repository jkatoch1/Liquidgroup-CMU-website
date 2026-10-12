/* LIQUID Group — shared site script.
   Pages are static HTML; everything that changes lives in /data/*.txt.
   This script parses those files and renders them. Edit the .txt files, never the HTML. */

(function () {
  "use strict";

  /* ---------- theme: follows the device, toggle overrides ---------- */
  let stored = null;
  try { stored = localStorage.getItem("liquid-theme"); } catch (e) { /* private mode etc. */ }
  if (stored === "dark" || stored === "light") document.documentElement.setAttribute("data-theme", stored);

  function currentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    const tbtn = document.getElementById("themeBtn");
    if (tbtn) {
      const paint = () => { tbtn.textContent = currentTheme() === "dark" ? "☀ Light" : "☾ Dark"; };
      paint();
      tbtn.addEventListener("click", function () {
        const next = currentTheme() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("liquid-theme", next); } catch (e) {}
        paint();
      });
    }
    const mbtn = document.getElementById("menuBtn");
    const links = document.getElementById("navLinks");
    if (mbtn && links) {
      mbtn.addEventListener("click", function () {
        const open = links.classList.toggle("open");
        mbtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  });

  /* ---------- data-file helpers ---------- */
  // Parses "a | b | c" lines; '#' starts a comment; '[SECTION]' switches section.
  // Each page folder owns its text files; every page lives one level below the site root.
  const DATA_DIR = {
    "members.txt": "../team/", "publications.txt": "../publications/",
    "news.txt": "../home/", "discoveries.txt": "../home/",
    "gallery.txt": "../gallery/", "news_media.txt": "../news_media/", "funding_agencies.txt": "../home/",
    "patents.txt": "../publications/", "research_content.txt": "../research/", "outreach.txt": "../outreach/",
    "facilities.txt": "../facilities/",
  };
  async function loadData(file) {
    const res = await fetch((DATA_DIR[file] || "../home/") + file, { cache: "no-cache" });
    if (!res.ok) throw new Error(file + ": " + res.status);
    const text = await res.text();
    const sections = {};
    let cur = "_";
    for (let raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^\[([A-Z0-9_ -]+)\]$/i);
      if (m) { cur = m[1].toUpperCase(); sections[cur] = sections[cur] || []; continue; }
      (sections[cur] = sections[cur] || []).push(line.split("|").map(s => s.trim()));
    }
    return sections;
  }
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const initials = name => name.split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase();

  function avatar(photo, name) {
    const fallback = '<span aria-hidden="true">' + esc(initials(name)) + "</span>";
    if (!photo || photo === "-") return '<div class="avatar">' + fallback + "</div>";
    return '<div class="avatar"><img src="../team/members_pic/' + esc(photo) + '" alt="' + esc(name) +
      '" loading="lazy" onerror="this.parentNode.innerHTML=\'' + initials(name) + '\'"></div>';
  }
  const mail = a => (a && a !== "-") ? '<a href="mailto:' + esc(a) + '">' + esc(a) + "</a>" : "";
  const nameHTML = (name, site) =>
    (site && site !== "-") ? '<a href="' + esc(site) + '">' + esc(name) + "</a>" : esc(name);

  /* ---------- team ---------- */
  async function renderTeam() {
    const root = document.getElementById("team-root");
    if (!root) return;
    const d = await loadData("members.txt");
    let h = "";

    h += '<h2 style="margin-top:0">Principal Investigators</h2><div class="member-grid">';
    for (const [id, name, title, office, email, links] of d.PIS || []) {
      const extra = (links && links !== "-")
        ? "<div class='meta'>" + links.split(";").map(p => {
            const [k, v] = p.split("=");
            return '<a href="' + esc(v) + '">' + esc(k) + "</a>";
          }).join(" · ") + "</div>" : "";
      h += '<div class="member">' + avatar(id, name) +
        '<div class="nm">' + esc(name) + '</div><div class="role">' + esc(title) + "</div>" +
        '<div class="meta">' + esc(office) + "<br>" + mail(email) + "</div>" + extra + "</div>";
    }
    h += "</div>";

    h += "<h2>Current Members</h2>";
    h += '<p class="eyebrow">Postdoctoral Researchers</p><div class="member-grid">';
    for (const [id, name, office, email, site, stmt] of d.POSTDOCS || []) {
      h += '<div class="member">' + avatar(id, name) +
        '<div class="nm">' + nameHTML(name, site) + '</div><div class="role">Postdoctoral Researcher</div>' +
        '<div class="meta">' + esc(office) + "<br>" + mail(email) + "</div>" +
        (stmt && stmt !== "-" ? '<div class="stmt">' + esc(stmt) + "</div>" : "") + "</div>";
    }
    h += "</div>";

    h += '<p class="eyebrow">PhD Students</p><div class="member-grid">';
    for (const [id, name, year, office, email, site, stmt] of d.GRADS || []) {
      h += '<div class="member">' + avatar(id, name) +
        '<div class="nm">' + nameHTML(name, site) + '</div><div class="role">PhD Student · ' + esc(year) + "</div>" +
        '<div class="meta">' + esc(office) + "<br>" + mail(email) + "</div>" +
        (stmt && stmt !== "-" ? '<div class="stmt">' + esc(stmt) + "</div>" : "") + "</div>";
    }
    h += "</div>";

    h += '<p class="eyebrow">Undergraduate Students</p><div class="member-grid">';
    for (const [id, name, dept] of d.UNDERGRADS || []) {
      h += '<div class="member">' +
        '<div class="nm">' + esc(name) + '</div><div class="role">' + esc(dept) + "</div></div>";
    }
    h += "</div>";

    h += "<h2>Alumni</h2>";
    const alumTable = (rows, thesis, hideYears, affilHeader) => {
      const header = affilHeader || "Current affiliation";
      let headerRow = hideYears ? '<tr><th>Name</th><th>' + header + '</th></tr>' : '<tr><th>Years</th><th>Name</th><th>' + header + '</th></tr>';
      let t = '<div class="table-scroll"><table class="alum-table">' + headerRow;
      for (const r of rows) {
        const [years, name, now, tt, tl] = r;
        if (hideYears) {
          t += "<tr><td>" + esc(name) +
            (thesis && tt && tt !== "-"
              ? '<div class="thesis">Thesis: ' + (tl && tl !== "-" ? '<a href="' + esc(tl) + '">' + esc(tt) + "</a>" : esc(tt)) + "</div>" : "") +
            "</td><td>" + esc(now === "-" ? "" : now) + "</td></tr>";
        } else {
          t += "<tr><td>" + esc(years === "-" ? "" : years) + "</td><td>" + esc(name) +
            (thesis && tt && tt !== "-"
              ? '<div class="thesis">Thesis: ' + (tl && tl !== "-" ? '<a href="' + esc(tl) + '">' + esc(tt) + "</a>" : esc(tt)) + "</div>" : "") +
            "</td><td>" + esc(now === "-" ? "" : now) + "</td></tr>";
        }
      }
      return t + "</table></div>";
    };
    h += '<p class="eyebrow">Graduate Students</p>' + alumTable(d.ALUMNI_GRAD || [], true, false);
    h += '<p class="eyebrow">Postdoctoral Researchers</p>' + alumTable(d.ALUMNI_POSTDOC || [], false, true, "Last known affiliation");
    h += '<p class="eyebrow">Master\'s Students</p>' + alumTable(d.ALUMNI_MASTER || [], false, true, "Last known affiliation");
    h += '<p class="eyebrow">Undergraduate Students</p>' + alumTable(d.ALUMNI_UNDERGRAD || [], false, true, "Last known affiliation");

    h += '<h2>Exchange Students &amp; Visitors</h2>' +
      '<div class="table-scroll"><table class="alum-table"><tr><th>Year</th><th>Name, program · institution</th></tr>';
    for (const [year, name, prog] of d.EXCHANGE || []) {
      h += "<tr><td>" + esc(year) + "</td><td>" + esc(name) + (prog && prog !== "-" ? ", " + esc(prog) : "") + "</td></tr>";
    }
    h += "</table></div>";

    root.innerHTML = h;
  }

  /* ---------- publications ---------- */
  async function renderPubs() {
    const root = document.getElementById("pubs-root");
    if (!root) return;
    const d = await loadData("publications.txt");
    const rows = d._ || [];
    const pre = rows.filter(r => r[0] === "P");
    const pubs = rows.filter(r => r[0] !== "P");

    const groupMembers = [
      "Jyoti Katoch", "Simranjeet Singh", "Aalok Tiwari", "I-Hsuan Kao",
      "Zhenhong Cui", "Raghvendra Posti", "Ravi Kumar", "Pratyush Saud",
      "Anshuman Sahoo", "Pratik Saud", "Ryan Muzzio", "Sandy Ekahana",
      "Sandy Adhitia Ekahana", "Ansu Sahoo"
    ];

    const boldGroupMembers = (text) => {
      let result = text;
      groupMembers.forEach(member => {
        const regex = new RegExp('\\b' + member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        result = result.replace(regex, '<strong>' + member + '</strong>');
      });
      return result;
    };

    const newsAndViews = d.NEWS_AND_VIEWS || [];
    const newsMap = {};
    newsAndViews.forEach(([pubNo, newsTitle, newsVenue, newsLink]) => {
      newsMap[pubNo] = { title: newsTitle, venue: newsVenue, link: newsLink };
    });

    const item = ([no, year, authors, title, venue, link], newsHighlight) => {
      let venueHTML = esc(venue);
      if (link && link !== "-") {
        venueHTML = '<a href="' + esc(link) + '" class="pub-link">' + esc(venue) + ' ↗</a>';
      }
      let newsHTML = "";
      if (newsHighlight) {
        let newsVenueHTML = esc(newsHighlight.venue);
        if (newsHighlight.link && newsHighlight.link !== "-") {
          newsVenueHTML = '<a href="' + esc(newsHighlight.link) + '" class="pub-link">' + esc(newsHighlight.venue) + ' ↗</a>';
        }
        newsHTML = '<div style="margin-top: 8px; margin-left: 16px; font-size: 0.9rem; color: var(--text);">' +
          '<strong>Highlighted in News and Views:</strong><div style="margin-top: 4px; margin-left: 16px;">' + esc(newsHighlight.title) + '</div>' +
          '<div class="venue" style="margin-left: 16px;">' + newsVenueHTML + '</div></div>';
      }
      return '<div class="pub">' +
      '<div><div class="title">' + esc(title) + '</div><div class="authors">' + boldGroupMembers(esc(authors)) + "</div>" +
      '<div class="venue">' + venueHTML + "</div>" + newsHTML + "</div></div>";
    };

    let h = "";
    if (pre.length) { h += '<div class="year-head">Preprints</div>'; pre.forEach(r => h += item(r)); }
    const byYear = {};
    pubs.forEach(r => (byYear[r[1]] = byYear[r[1]] || []).push(r));
    Object.keys(byYear).sort((a, b) => b - a).forEach(y => {
      h += '<div class="year-head">' + esc(y) + "</div>";
      byYear[y].sort((a, b) => Number(b[0]) - Number(a[0])).forEach(r => h += item(r, newsMap[r[0]]));
    });
    root.innerHTML = h;

    // Patents from publications/patents.txt
    try {
      const p = await loadData("patents.txt");
      const patentsList = document.getElementById("patents-list");
      if (patentsList) {
        patentsList.innerHTML = (p._ || []).map(([number, title, date, link]) =>
          "<li style='margin-bottom: 12px;'>" +
          (link && link !== "-" ? '<a href="' + esc(link) + '">' + esc(number) + " — " + esc(title) + "</a>" : esc(number) + " — " + esc(title)) +
          (date && date !== "-" ? ' (' + esc(date) + ')' : '') +
          "</li>").join("");
      }
    } catch (e) {}
  }

  /* ---------- home: news, spotlight, snapshot, funding ---------- */
  async function renderHome() {
    const newsRoot = document.getElementById("home-news");
    if (!newsRoot) return;

    try {
      const n = await loadData("news_media.txt");
      const items = (n._ || []).slice(0, 5);
      newsRoot.innerHTML = items.map((row, idx) => {
        const year = row[0], date = row[1], title = row[2], link = row[3];
        if (idx === 0) console.log("First news row:", {year, date, title, link, linkIsHyphen: link === "-"});
        let dateStr = "";
        if (date && date !== "-") {
          dateStr = (date.includes("-") ? date : date + "-01");
        }
        const content = (link && link !== "-") ? '<a href="' + esc(link) + '">' + esc(title) + "</a>" : esc(title);
        const when = dateStr ? '<span class="when">' + esc(dateStr) + "</span> " : "";
        return "<li>" + when + content + "</li>";
      }).join("");
    } catch (e) { newsRoot.innerHTML = "<li>News feed unavailable.</li>"; }

    // Field highlight: one item from the curated pool in data/discoveries.txt,
    // rotated monthly (seeded by year+month, so it changes once a month, not per reload).
    try {
      const disc = await loadData("discoveries.txt");
      const pool = disc._ || [];
      if (pool.length) {
        const now = new Date();
        const pick = pool[(now.getFullYear() * 12 + now.getMonth()) % pool.length];
        const [title, link] = pick;
        document.getElementById("spotlight-body").innerHTML =
          (link && link !== "-" ? '<a href="' + esc(link) + '">' + esc(title) + "</a>" : esc(title));
      }
    } catch (e) {}

    // Snapshot: rotating gallery with arrows and 30-second auto-advance.
    try {
      const g = await loadData("gallery.txt");
      const rows = (g._ || []).filter(r => r[0] && r[0] !== "-");
      if (!rows.length) return;

      const img = document.getElementById("snapshot-img");
      const prevBtn = document.getElementById("snapshot-prev");
      const nextBtn = document.getElementById("snapshot-next");
      let currentIndex = Math.floor(Math.random() * rows.length);
      let autoRotateInterval = null;

      const showImage = (index) => {
        const [file, year, caption] = rows[index];
        img.src = "../gallery/gallery/" + file;
        img.alt = caption;
        document.getElementById("snapshot-cap").textContent = caption + " (" + year + ")";
        clearInterval(autoRotateInterval);
        autoRotateInterval = setInterval(() => {
          currentIndex = (currentIndex + 1) % rows.length;
          showImage(currentIndex);
        }, 30000);
      };

      if (prevBtn && nextBtn) {
        prevBtn.addEventListener("click", () => {
          currentIndex = (currentIndex - 1 + rows.length) % rows.length;
          showImage(currentIndex);
        });
        nextBtn.addEventListener("click", () => {
          currentIndex = (currentIndex + 1) % rows.length;
          showImage(currentIndex);
        });
      }

      showImage(currentIndex);
    } catch (e) {}

    // Funding agencies from home/funding_logos/funding_agencies.txt (logos only, no text labels).
    try {
      const f = await loadData("funding_agencies.txt");
      document.getElementById("funding-row").innerHTML = (f._ || []).map(([name, url, logo]) =>
        '<a href="' + esc(url) + '" title="' + esc(name) + '">' +
        (logo && logo !== "-" ? '<img src="../home/funding_logos/' + esc(logo) + '" alt="' + esc(name) + ' logo" onerror="this.remove()">' : "") +
        "</a>").join("");
    } catch (e) {}
  }

  /* ---------- gallery ---------- */
  async function renderGallery() {
    const root = document.getElementById("gallery-root");
    if (!root) return;
    const d = await loadData("gallery.txt");
    const rows = (d._ || []).slice().sort((a, b) => Number(b[1]) - Number(a[1]));
    root.innerHTML = rows.map(([file, year, caption]) =>
      '<figure class="gal-item"><div class="ph">' +
      (file && file !== "-" ? '<img src="../gallery/gallery/' + esc(file) + '" alt="' + esc(caption) +
        '" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'photo pending\'))">' : "photo pending") +
      '</div><figcaption><span class="y">' + esc(year) + "</span>" + esc(caption) + "</figcaption></figure>").join("");
  }

  /* ---------- outreach timeline and gallery ---------- */
  async function renderOutreach() {
    const root = document.getElementById("outreach-root");
    if (!root) return;
    const d = await loadData("outreach.txt");
    const byYear = {};
    for (const section in d) {
      if (section === "_") continue;
      const year = section;
      byYear[year] = { events: [], images: [] };
      for (const [type, ...rest] of d[section]) {
        if (type === "event") {
          byYear[year].events.push(rest.join(" | "));
        } else if (type === "image") {
          const [file, caption] = rest;
          byYear[year].images.push({ file, caption });
        }
      }
    }
    const years = Object.keys(byYear).sort((a, b) => b - a);
    let h = '<ul class="timeline">';
    for (const y of years) {
      h += '<li><span class="yr">' + esc(y) + "</span>";
      if (byYear[y].events.length) {
        h += '<ul>' + byYear[y].events.map(event => "<li>" + esc(event) + "</li>").join("") + "</ul>";
      }
      if (byYear[y].images.length) {
        const galleryId = "gallery-" + y;
        h += '<div class="outreach-gallery-wrapper">' +
          '<div class="outreach-gallery-scroll" id="' + galleryId + '-scroll">' +
          '<div class="outreach-gallery" id="' + galleryId + '">' +
          byYear[y].images.map(img =>
            '<figure class="outreach-item"><img src="../outreach/outreach_pictures/' + esc(img.file) +
            '" alt="' + esc(img.caption) + '" loading="lazy"><figcaption>' + esc(img.caption) + '</figcaption></figure>'
          ).join("") + '</div></div>' +
          '<button class="outreach-nav outreach-nav-prev" data-gallery="' + galleryId + '">‹</button>' +
          '<button class="outreach-nav outreach-nav-next" data-gallery="' + galleryId + '">›</button>' +
          '</div>';
      }
      h += '</li>';
    }
    h += '</ul>';
    root.innerHTML = h;

    document.querySelectorAll('.outreach-nav').forEach(btn => {
      btn.addEventListener('click', function() {
        const galleryId = this.dataset.gallery;
        const gallery = document.getElementById(galleryId);
        const itemWidth = gallery.querySelector('.outreach-item').offsetWidth + 12;
        const direction = this.classList.contains('outreach-nav-next') ? 1 : -1;
        gallery.parentElement.scrollBy({ left: itemWidth * 3 * direction, behavior: 'smooth' });
        updateCarouselButtons(galleryId);
      });
    });

    document.querySelectorAll('.outreach-gallery-scroll').forEach(scroll => {
      const galleryId = scroll.querySelector('.outreach-gallery').id;
      updateCarouselButtons(galleryId);
      scroll.addEventListener('scroll', () => updateCarouselButtons(galleryId));
    });
  }

  function updateCarouselButtons(galleryId) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    const scroll = gallery.parentElement;
    const prevBtn = document.querySelector('[data-gallery="' + galleryId + '"].outreach-nav-prev');
    const nextBtn = document.querySelector('[data-gallery="' + galleryId + '"].outreach-nav-next');

    if (prevBtn) prevBtn.disabled = scroll.scrollLeft <= 0;
    if (nextBtn) nextBtn.disabled = scroll.scrollLeft >= scroll.scrollWidth - scroll.clientWidth - 10;
  }

  /* ---------- news & media (last 5 years shown; archive on demand) ---------- */
  async function renderNewsMedia() {
    const root = document.getElementById("newsmedia-root");
    if (!root) return;
    const d = await loadData("news_media.txt");
    const rows = d._ || [];
    const byYear = {};
    rows.forEach(([year, date, title, link]) => (byYear[year] = byYear[year] || []).push([date, title, link]));
    const years = Object.keys(byYear).sort((a, b) => b - a);
    const cutoff = new Date().getFullYear() - 4;

    const block = ys => '<ul class="timeline">' + ys.map(y =>
      '<li><span class="yr">' + esc(y) + "</span><ul>" + byYear[y].map(([date, title, link]) =>
        "<li>" + (date && date !== "-" ? '<span class="d">' + esc(date) + "</span>" : "") +
        (link && link !== "-" ? '<a href="' + esc(link) + '">' + esc(title) + "</a>" : esc(title)) +
        "</li>").join("") + "</ul></li>").join("") + "</ul>";

    const recent = years.filter(y => Number(y) >= cutoff);
    const older = years.filter(y => Number(y) < cutoff);
    root.innerHTML = block(recent) +
      (older.length ? '<button class="btn" id="archiveBtn">Show older news (' + older[older.length - 1] + "–" + older[0] + ")</button><div id='archive' hidden></div>" : "");
    const ab = document.getElementById("archiveBtn");
    if (ab) ab.addEventListener("click", () => {
      document.getElementById("archive").innerHTML = block(older);
      document.getElementById("archive").hidden = false;
      ab.remove();
    });
  }

  /* ---------- research content from research_content.txt ---------- */
  async function renderResearch() {
    const katochPanel = document.getElementById("panel-katoch");
    const singhPanel = document.getElementById("panel-singh");
    if (!katochPanel && !singhPanel) return;

    try {
      const d = await loadData("research_content.txt");

      const renderThrusts = (title, data) => {
        let h = '<h2 style="margin-top:0">' + esc(title) + '</h2>';
        for (const [thrust_title, description, image, tags] of data) {
          h += '<div class="thrust"><div>' +
            '<h3>' + esc(thrust_title) + '</h3>' +
            '<p>' + esc(description) + '</p>';
          if (tags && tags !== "-") {
            const tag_list = tags.split(",").map(t => t.trim());
            h += '<div class="tags">' + tag_list.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>';
          }
          h += '</div>';
          if (image && image !== "-") {
            h += '<div class="fig"><img src="../research/research_images/' + esc(image) + '" alt="' + esc(thrust_title) + '" loading="lazy"></div>';
          } else {
            h += '<div class="fig"></div>';
          }
          h += '</div>';
        }
        return h;
      };

      // Render Katoch intro + thrusts
      if (katochPanel) {
        let katoch_h = "";
        if (d.KATOCH_INTRO) {
          katoch_h += '<p class="eyebrow">Research Philosophy</p>';
          for (const [_, description, __, ___] of d.KATOCH_INTRO) {
            katoch_h += '<p class="prose">' + esc(description) + '</p>';
          }
          katoch_h += '<p class="eyebrow">Research Thrusts</p>';
        }
        katoch_h += renderThrusts("", d.KATOCH || []);
        katochPanel.innerHTML = katoch_h;
      }

      // Render Singh intro + thrusts
      if (singhPanel) {
        let singh_h = "";
        if (d.SINGH_INTRO) {
          singh_h += '<p class="eyebrow">Research Focus</p>';
          for (const [_, description, __, ___] of d.SINGH_INTRO) {
            singh_h += '<p class="prose">' + esc(description) + '</p>';
          }
          singh_h += '<p class="eyebrow">Research Thrusts</p>';
        }
        singh_h += renderThrusts("", d.SINGH || []);
        singh_h += '<p class="pub-note">Selected papers for each thrust are on the <a href="../publications/publications.html">Publications</a> page.</p>';
        singhPanel.innerHTML = singh_h;
      }
    } catch (e) {
      console.error("Error rendering research:", e);
    }
  }

  /* ---------- facilities from facilities.txt ---------- */
  let currentFacilityImages = [];
  let currentImageIndex = 0;

  // Photo paths in facilities.txt are relative to facilities/facilities_images/ (full URLs also work).
  const facImg = p => /^https?:\/\//.test(p) ? p : "../facilities/facilities_images/" + p.split("/").map(encodeURIComponent).join("/");
  const facList = s => (s || "").split(",").map(x => x.trim()).filter(Boolean);
  const facSpecs = s => (s || "").split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf(":");
    return i < 0 ? ["", x] : [x.slice(0, i).trim(), x.slice(i + 1).trim()];
  });

  function openImageModal(imageList, start) {
    currentFacilityImages = imageList;
    if (currentFacilityImages.length > 0) {
      currentImageIndex = start || 0;
      showImageModal();
    }
  }

  function showImageModal() {
    const modal = document.getElementById('imageModal');
    if (currentImageIndex < 0 || currentImageIndex >= currentFacilityImages.length) return;

    document.getElementById('modalImage').src = facImg(currentFacilityImages[currentImageIndex]);
    document.getElementById('imageCounter').textContent = (currentImageIndex + 1) + ' / ' + currentFacilityImages.length;
    document.getElementById('prevBtn').disabled = currentImageIndex === 0;
    document.getElementById('nextBtn').disabled = currentImageIndex === currentFacilityImages.length - 1;
    modal.style.display = 'flex';
  }

  function facSpecRows(specs) {
    if (!specs.length) return '';
    let h = '<dl class="fac-specs">';
    for (const [k, v] of specs) h += '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
    return h + '</dl>';
  }

  async function renderFacilities() {
    const root = document.getElementById("facilities-root");
    if (!root) return;

    try {
      const d = await loadData("facilities.txt");
      const galleries = [];
      let h = '';

      // In-house: photos (one large, two small) beside the description and specs
      if (d["IN-HOUSE"] && d["IN-HOUSE"].length > 0) {
        h += '<p class="eyebrow">In-house equipment</p>';
        for (const [name, label, description, images, specs, note] of d["IN-HOUSE"]) {
          const photos = facList(images);
          const specList = facSpecs(specs);
          h += '<article class="fac-item' + (photos.length ? '' : ' fac-item-text') + '">';
          if (photos.length) {
            const g = galleries.push(photos) - 1;
            h += '<div class="fac-photos">';
            photos.slice(0, 3).forEach((p, i) => {
              const more = (i === 2 && photos.length > 3) ? '<span class="fac-more">+' + (photos.length - 3) + ' more</span>' : '';
              h += '<button type="button" class="fac-photo' + (i === 0 ? ' fac-photo-main' : '') + '" data-gallery="' + g + '" data-index="' + i + '" aria-label="View photos of ' + esc(name) + '">'
                + '<img src="' + esc(facImg(p)) + '" alt="' + esc(name) + ' photo ' + (i + 1) + '" loading="lazy">' + more + '</button>';
            });
            h += '</div>';
          }
          h += '<div class="fac-body">';
          if (label) h += '<div class="fac-label">' + esc(label) + '</div>';
          h += '<h3>' + esc(name || '') + '</h3>';
          if (description) h += '<p>' + esc(description) + '</p>';
          if (photos.length) {
            h += facSpecRows(specList);
          } else if (specList.length) {
            // No photos: show each spec as a bulleted group (e.g. the electronics suite)
            h += '<div class="fac-groups">';
            for (const [k, v] of specList) {
              h += '<div><div class="fac-group-label">' + esc(k) + '</div><ul>' + facList(v).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
            }
            h += '</div>';
          }
          if (note) h += '<p class="fac-note">' + esc(note) + '</p>';
          h += '</div></article>';
        }
      }

      // Synchrotron programs: photo cards
      if (d["SYNCHROTRON"] && d["SYNCHROTRON"].length > 0) {
        h += '<p class="eyebrow">Photoemission spectroscopy — synchrotron access</p>';
        h += '<p class="fac-intro">Our group uses ARPES, XMCD, and XMLD techniques at world-class synchrotron facilities to probe the electronic and magnetic structure of novel quantum materials. Samples are transferred in our custom UHV suitcase to preserve surface cleanliness.</p>';
        h += '<div class="fac-syn-grid">';
        for (const [name, facility, location, description, image, url, specs] of d["SYNCHROTRON"]) {
          h += '<article class="card fac-syn">';
          if (image) h += '<img src="' + esc(facImg(image)) + '" alt="' + esc(facility || name) + '" loading="lazy">';
          if (location) h += '<div class="fac-label">' + esc(location) + '</div>';
          h += '<h3>' + esc(name || '') + '</h3>';
          if (facility) h += '<div class="fac-facility">' + esc(facility) + '</div>';
          if (description) h += '<p>' + esc(description) + '</p>';
          h += facSpecRows(facSpecs(specs));
          if (url) h += '<a class="fac-link" href="' + esc(url) + '" target="_blank" rel="noopener">→ ' + esc(name) + ' beamline</a>';
          h += '</article>';
        }
        h += '</div>';
      }

      root.innerHTML = h;

      // Clicking any photo opens the viewer at that photo
      root.querySelectorAll('.fac-photo').forEach(btn => {
        btn.addEventListener('click', () => openImageModal(galleries[+btn.dataset.gallery], +btn.dataset.index));
      });

      // Modal controls
      const modal = document.getElementById('imageModal');
      const closeBtn = document.querySelector('.modal-close');
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');

      closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
      prevBtn.addEventListener('click', () => {
        if (currentImageIndex > 0) {
          currentImageIndex--;
          showImageModal();
        }
      });
      nextBtn.addEventListener('click', () => {
        if (currentImageIndex < currentFacilityImages.length - 1) {
          currentImageIndex++;
          showImageModal();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (modal.style.display !== 'none') {
          if (e.key === 'Escape') modal.style.display = 'none';
          if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
            currentImageIndex--;
            showImageModal();
          }
          if (e.key === 'ArrowRight' && currentImageIndex < currentFacilityImages.length - 1) {
            currentImageIndex++;
            showImageModal();
          }
        }
      });
    } catch (e) {
      console.error("Error rendering facilities:", e);
    }
  }

  /* ---------- research tabs ---------- */
  function initResearchTabs() {
    const tabs = document.querySelectorAll(".pi-tabs button");
    if (!tabs.length) return;
    tabs.forEach(btn => btn.addEventListener("click", () => {
      tabs.forEach(b => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
      document.querySelectorAll(".pi-panel").forEach(p => { p.hidden = p.id !== btn.dataset.panel; });
    }));
  }

  document.addEventListener("DOMContentLoaded", function () {
    initResearchTabs();
    renderTeam().catch(console.error);
    renderPubs().catch(console.error);
    renderHome().catch(console.error);
    renderGallery().catch(console.error);
    renderOutreach().catch(console.error);
    renderNewsMedia().catch(console.error);
    renderResearch().catch(console.error);
    renderFacilities().catch(console.error);
  });
})();
