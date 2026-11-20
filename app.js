// === ضع بيانات مشروع Supabase الجديد هنا ===
const SUPABASE_URL = 'ضع_هنا_رابط_المشروع_الجديد';
const SUPABASE_KEY = 'ضع_هنا_مفتاح_sb_publishable_الجديد';

const DEFAULT_OFFER_IMG = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=700&q=80';
const DEFAULT_PLACE_LOGO = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=300&q=80';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let banners = [];
let categories = [];
let places = [];
let offers = [];

let placesMap = {};
let categoriesMap = {};
let activeCategory = 'all';

async function loadAllData() {
  try {
    const [bRes, cRes, pRes, oRes] = await Promise.all([
      db.from('banners').select('*').eq('is_active', true).order('sort', { ascending: true }),
      db.from('categories').select('*').order('sort', { ascending: true }),
      db.from('places').select('*').order('id', { ascending: false }),
      db.from('offers').select('*').eq('is_active', true).order('id', { ascending: false })
    ]);

    if (bRes.error) throw bRes.error;
    if (cRes.error) throw cRes.error;
    if (pRes.error) throw pRes.error;
    if (oRes.error) throw oRes.error;

    banners = bRes.data || [];
    categories = cRes.data || [];
    places = pRes.data || [];
    offers = oRes.data || [];

    categoriesMap = {};
    categories.forEach(c => { categoriesMap[String(c.id)] = c; });

    placesMap = {};
    places.forEach(p => { placesMap[String(p.id)] = p; });

    renderBanners();
    renderFilters();
    renderFeaturedOffers();
    renderPlaces();
    renderOffersGrid();
    checkSharedOffer();
  } catch (err) {
    document.getElementById('offersGrid').innerHTML = `
      <div class="empty-state">
        ⚠️ تعذر تحميل العروض من Supabase.<br>
        تأكد من وضع رابط المشروع ومفتاح الـ API الصحيح في ملف <code>app.js</code>.
      </div>
    `;
    console.error(err);
  }
}

function renderBanners() {
  const wrapper = document.getElementById('bannersWrapper');
  const container = document.getElementById('bannersContainer');

  if (banners.length === 0) {
    wrapper.style.display = 'none';
    return;
  }

  container.innerHTML = banners.map(b => `
    <div class="swiper-slide">
      <${b.link ? `a href="${b.link}" target="_blank"` : 'div'} class="banner-slide">
        <img src="${b.image}" alt="${b.title || 'عرض'}" />
        ${b.title ? `<div class="banner-overlay"><div class="banner-title">${b.title}</div></div>` : ''}
      </${b.link ? 'a' : 'div'}>
    </div>
  `).join('');

  new Swiper('.banners-swiper', {
    loop: banners.length > 1,
    autoplay: { delay: 4000, disableOnInteraction: false },
    pagination: { el: '.banner-pagination', clickable: true },
    navigation: { nextEl: '.banner-next', prevEl: '.banner-prev' }
  });
}

function renderFilters() {
  // تعبئة المجالات
  const tabs = document.getElementById('categoriesTabs');
  categories.forEach(c => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    slide.innerHTML = `<button class="cat-pill" data-cat="${c.id}">${c.icon || '🏷️'} ${c.name}</button>`;
    tabs.appendChild(slide);
  });

  new Swiper('.categories-swiper', { slidesPerView: 'auto', spaceBetween: 8, freeMode: true });

  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderOffersGrid();
    });
  });

  // تعبئة المناطق/الأحياء تلقائياً من المحلات المسجلة
  const areaSelect = document.getElementById('areaFilter');
  const areas = [...new Set(places.map(p => (p.area || '').trim()).filter(Boolean))];
  areas.forEach(area => {
    areaSelect.innerHTML += `<option value="${area}">📍 ${area}</option>`;
  });

  document.getElementById('searchInput').addEventListener('input', renderOffersGrid);
  areaSelect.addEventListener('change', renderOffersGrid);
}

function buildOfferCardHTML(offer) {
  const place = placesMap[String(offer.place_id)] || {};
  const hasPrices = offer.new_price !== null && offer.new_price !== undefined;
  const cleanPhone = (place.phone || '').replace(/[^0-9]/g, '');

  let badgeText = offer.discount_text;
  if (!badgeText && offer.old_price && offer.new_price && Number(offer.old_price) > Number(offer.new_price)) {
    const pct = Math.round(((offer.old_price - offer.new_price) / offer.old_price) * 100);
    badgeText = `خصم ${pct}% 🔥`;
  }

  return `
    <article class="offer-card">
      <div class="offer-img-box" onclick="openOfferModal(${offer.id})">
        ${badgeText ? `<span class="discount-tag">${badgeText}</span>` : ''}
        <button class="share-icon-btn" title="مشاركة العرض" onclick="shareOffer(${offer.id}, event)">🔗</button>
        <img src="${offer.image || DEFAULT_OFFER_IMG}" alt="${offer.title}" loading="lazy" onerror="this.src='${DEFAULT_OFFER_IMG}'" />
      </div>

      <div class="offer-body">
        <div class="offer-place-row">
          <button type="button" class="offer-place-btn" onclick="openPlaceModal(${place.id})">
            🏪 ${place.name || 'مكان مشارك'}
          </button>
          ${offer.end_date ? `<span class="offer-end">⏳ حتى ${offer.end_date}</span>` : ''}
        </div>

        <h3 class="offer-title" onclick="openOfferModal(${offer.id})">${offer.title}</h3>
        ${offer.description ? `<p class="offer-desc">${offer.description}</p>` : ''}
        ${place.address ? `<div class="offer-address">📍 ${place.area ? place.area + ' - ' : ''}${place.address}</div>` : ''}

        ${hasPrices ? `
          <div class="offer-price-row">
            <span class="new-price">${offer.new_price} ج.م</span>
            ${offer.old_price ? `<span class="old-price">${offer.old_price} ج.م</span>` : ''}
          </div>
        ` : ''}

        ${cleanPhone ? `
          <div class="offer-actions">
            <a href="tel:+${cleanPhone}" class="btn-call">📞 اتصال</a>
            <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`مرحباً ${place.name}، أستفسر عن عرض: ${offer.title}`)}" target="_blank" class="btn-wa">💬 واتساب</a>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

function renderFeaturedOffers() {
  const featured = offers.filter(o => o.is_featured);
  const section = document.getElementById('featuredSection');
  if (featured.length === 0) return;

  section.style.display = 'block';
  document.getElementById('featuredContainer').innerHTML = featured.map(o => `
    <div class="swiper-slide">${buildOfferCardHTML(o)}</div>
  `).join('');

  new Swiper('.featured-swiper', {
    slidesPerView: 1.15,
    spaceBetween: 16,
    autoplay: { delay: 3600, pauseOnMouseEnter: true },
    pagination: { el: '.featured-swiper .swiper-pagination', clickable: true },
    navigation: { nextEl: '.featured-swiper .swiper-button-next', prevEl: '.featured-swiper .swiper-button-prev' },
    breakpoints: {
      640: { slidesPerView: 2.2 },
      960: { slidesPerView: 3.2 },
      1200: { slidesPerView: 3.6 }
    }
  });
}

function renderPlaces() {
  if (places.length === 0) return;
  document.getElementById('placesSection').style.display = 'block';

  document.getElementById('placesContainer').innerHTML = places.map(place => {
    const count = offers.filter(o => String(o.place_id) === String(place.id)).length;
    const cat = categoriesMap[String(place.category_id)];
    return `
      <div class="swiper-slide">
        <div class="place-card" onclick="openPlaceModal(${place.id})">
          <img src="${place.logo || DEFAULT_PLACE_LOGO}" alt="${place.name}" class="place-logo" onerror="this.src='${DEFAULT_PLACE_LOGO}'" />
          <div class="place-meta">
            <h4>${place.name}</h4>
            <span>${cat ? cat.icon + ' ' + cat.name : ''} • ${place.area || place.address}</span>
            <span class="place-offers-badge">${count} عروض متاحة</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  new Swiper('.places-swiper', {
    slidesPerView: 1.25,
    spaceBetween: 14,
    navigation: { nextEl: '.places-swiper .swiper-button-next', prevEl: '.places-swiper .swiper-button-prev' },
    breakpoints: {
      640: { slidesPerView: 2.3 },
      980: { slidesPerView: 3.3 }
    }
  });
}

function renderOffersGrid() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const area = document.getElementById('areaFilter').value;

  const filtered = offers.filter(o => {
    const place = placesMap[String(o.place_id)] || {};
    const matchCat = activeCategory === 'all' || String(place.category_id) === String(activeCategory);
    const matchArea = area === 'all' || (place.area || '').trim() === area;
    const matchText =
      (o.title || '').toLowerCase().includes(search) ||
      (o.description || '').toLowerCase().includes(search) ||
      (place.name || '').toLowerCase().includes(search) ||
      (place.address || '').toLowerCase().includes(search);

    return matchCat && matchArea && matchText;
  });

  document.getElementById('offersCountText').textContent = `إجمالي العروض المتاحة: ${filtered.length} عرض`;

  const grid = document.getElementById('offersGrid');
  grid.innerHTML = filtered.length === 0
    ? '<div class="empty-state">لا توجد عروض مطابقة لبحثك حالياً 🔎</div>'
    : filtered.map(o => buildOfferCardHTML(o)).join('');
}

// نافذة ملف المكان وكل عروضه
function openPlaceModal(placeId) {
  const place = placesMap[String(placeId)];
  if (!place) return;
  const placeOffers = offers.filter(o => String(o.place_id) === String(placeId));
  const cleanPhone = (place.phone || '').replace(/[^0-9]/g, '');

  document.getElementById('placeModalBody').innerHTML = `
    <div class="place-profile-head">
      <img src="${place.logo || DEFAULT_PLACE_LOGO}" alt="${place.name}" />
      <div>
        <h2 style="color:var(--navy);font-size:1.3rem;">${place.name}</h2>
        <p style="font-size:0.86rem;color:var(--muted);">📍 ${place.area ? place.area + ' - ' : ''}${place.address}</p>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          ${cleanPhone ? `<a href="tel:+${cleanPhone}" class="btn-call" style="padding:5px 12px;">📞 اتصال</a>` : ''}
          ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-wa" style="padding:5px 12px;">💬 واتساب</a>` : ''}
          ${place.map_link ? `<a href="${place.map_link}" target="_blank" class="btn-call" style="background:#2563EB;padding:5px 12px;">🗺️ الخريطة</a>` : ''}
        </div>
      </div>
    </div>
    <div class="place-profile-offers">
      <h4 style="color:var(--navy);">🔥 عروض ${place.name} (${placeOffers.length}):</h4>
      ${placeOffers.length === 0
        ? '<p style="color:var(--muted);">لا توجد عروض نشطة حالياً لهذا المكان.</p>'
        : placeOffers.map(o => `
            <div class="mini-offer-row">
              <img src="${o.image || DEFAULT_OFFER_IMG}" alt="${o.title}" />
              <div style="flex:1;">
                <strong style="display:block;color:var(--navy);">${o.title}</strong>
                <span style="font-size:0.8rem;color:var(--muted);">${o.description || ''}</span>
                <div style="margin-top:4px;">
                  ${o.new_price ? `<span class="new-price" style="font-size:1rem;">${o.new_price} ج.م</span>` : ''}
                  ${o.old_price ? `<span class="old-price" style="margin-right:6px;">${o.old_price} ج.م</span>` : ''}
                </div>
              </div>
              <button class="share-icon-btn" style="position:static;" onclick="shareOffer(${o.id}, event)">🔗</button>
            </div>
          `).join('')
      }
    </div>
  `;

  document.getElementById('placeModalOverlay').classList.add('open');
}

// نافذة العرض الواحد
function openOfferModal(offerId) {
  const offer = offers.find(o => String(o.id) === String(offerId));
  if (!offer) return;
  const place = placesMap[String(offer.place_id)] || {};
  const cleanPhone = (place.phone || '').replace(/[^0-9]/g, '');

  document.getElementById('offerModalBody').innerHTML = `
    <img src="${offer.image || DEFAULT_OFFER_IMG}" alt="${offer.title}" style="width:100%;height:260px;object-fit:cover;display:block;" />
    <div style="padding:20px;">
      <button type="button" class="offer-place-btn" onclick="closeModal('offerModalOverlay'); openPlaceModal(${place.id})">
        🏪 ${place.name || ''} — اضغط لعرض كل عروض المكان
      </button>
      <h2 style="margin:10px 0 6px;color:var(--navy);">${offer.title}</h2>
      <p style="color:var(--muted);font-size:0.95rem;">${offer.description || ''}</p>
      <p style="margin-top:8px;font-size:0.86rem;color:#475569;">📍 ${place.area ? place.area + ' - ' : ''}${place.address || ''}</p>
      ${offer.end_date ? `<p style="color:var(--hot);font-size:0.85rem;font-weight:700;margin-top:4px;">⏳ ساري حتى: ${offer.end_date}</p>` : ''}

      ${offer.new_price ? `
        <div class="offer-price-row" style="margin-top:12px;">
          <span class="new-price" style="font-size:1.5rem;">${offer.new_price} ج.م</span>
          ${offer.old_price ? `<span class="old-price">${offer.old_price} ج.م</span>` : ''}
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
        ${cleanPhone ? `<a href="tel:+${cleanPhone}" class="btn-call" style="flex:1;padding:11px;">📞 اتصال</a>` : ''}
        ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`مرحباً ${place.name}، أستفسر عن عرض: ${offer.title}`)}" target="_blank" class="btn-wa" style="flex:1;padding:11px;">💬 واتساب</a>` : ''}
        <button type="button" onclick="shareOffer(${offer.id}, event)" style="flex:1;padding:11px;border-radius:10px;border:1.5px solid var(--navy);background:#fff;font-family:inherit;font-weight:800;cursor:pointer;">🔗 مشاركة</button>
      </div>
    </div>
  `;

  document.getElementById('offerModalOverlay').classList.add('open');
}

async function shareOffer(offerId, event) {
  if (event) event.stopPropagation();
  const offer = offers.find(o => String(o.id) === String(offerId));
  if (!offer) return;
  const place = placesMap[String(offer.place_id)] || {};
  const url = `${window.location.origin}${window.location.pathname}?offer=${offer.id}`;
  const text = `🔥 عرض من *${place.name || 'عرووض'}*:\n${offer.title}${offer.new_price ? ` بـ ${offer.new_price} ج.م فقط!` : ''}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: offer.title, text, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
    alert('✅ تم نسخ تفاصيل ورابط العرض للمشاركة!');
  });
}

function checkSharedOffer() {
  const id = new URLSearchParams(window.location.search).get('offer');
  if (id) openOfferModal(id);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

loadAllData();
