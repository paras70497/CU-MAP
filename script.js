/* ============================================================
   CU Campus Guide — Main Script
   ============================================================ */

// ──────────────────────────────────────────────
// 1. Predefined Campus Locations
// ──────────────────────────────────────────────
const campusLocations = [
  // ── Food ──
  { name: "PFC Food Court",          lat: 30.7715064, lng: 76.5694492, category: "food"    },
  { name: "Food Republic",           lat: 30.7668459, lng: 76.5760314, category: "food"    },
  { name: "The Corner Cafe",         lat: 30.7691371, lng: 76.5763082, category: "food"    },
  { name: "Urban Cafe",              lat: 30.772447,  lng: 76.5748641, category: "food"    },
  // ── Library ──
  { name: "Central Library",         lat: 30.7701683, lng: 76.5755912, category: "library" },
  { name: "DD1 Block Library",       lat: 30.7735722, lng: 76.5695049, category: "library" },
  // ── Block ──
  { name: "Block A1",                lat: 30.7716488, lng: 76.5782589, category: "block"   },
  { name: "Block B2",                lat: 30.7691341, lng: 76.5758641, category: "block"   },
  { name: "Block D5",                lat: 30.7709588, lng: 76.5697969, category: "block"   },
  { name: "Block 17",                lat: 30.7735523, lng: 76.5708688, category: "block"   },
  { name: "South Campus",            lat: 30.7708668, lng: 76.5703153, category: "block"   },
  // ── Ground ──
  { name: "CU Main Ground",          lat: 30.7670957, lng: 76.5753727, category: "ground"  },
  { name: "Main Sports Ground",      lat: 30.768908,  lng: 76.5687556, category: "ground"  },
  { name: "CU Cricket Ground",       lat: 30.7669867, lng: 76.5740000, category: "ground"  },
  { name: "Basketball Court",        lat: 30.7685000, lng: 76.5700000, category: "ground"  },
];

// ──────────────────────────────────────────────
// 2. Global State
// ──────────────────────────────────────────────
let map;                          // Google Map instance
let markers          = [];        // All campus markers on the map
let userMarker       = null;      // User's own location marker
let userPosition     = null;      // { lat, lng } of the user
let activeCategory   = "all";     // Current filter
let infoWindow;                   // Shared InfoWindow
let isMobile         = window.innerWidth < 768; // responsive check
let savedPlaces      = JSON.parse(localStorage.getItem("cu_saved") || "[]"); // saved bookmarks
let activeTab        = "explore"; // current mobile tab

// ──────────────────────────────────────────────
// 3. Initialise the Map (Google Maps callback)
// ──────────────────────────────────────────────
function initMap() {
  // CU campus center coordinates (actual campus midpoint)
  const cuCenter = { lat: 30.7700, lng: 76.5730 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: cuCenter,
    zoom: 16,
    mapTypeControl: true,
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.TOP_RIGHT,
    },
    streetViewControl: false,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "simplified" }] },
    ],
  });

  infoWindow = new google.maps.InfoWindow();

  // Place campus markers
  placeMarkers(campusLocations);

  // Populate the "All Locations" list
  renderAllLocations(campusLocations);

  // Attach filter‑button event listeners
  initFilterButtons();

  // Request the user's geolocation
  requestUserLocation();

  // "My Location" FAB on mobile
  const locateBtn = document.getElementById("locate-btn");
  if (locateBtn) {
    locateBtn.addEventListener("click", () => {
      if (userPosition) {
        map.panTo(userPosition);
        map.setZoom(17);
      } else {
        requestUserLocation();
      }
    });
  }

  // Track viewport changes
  window.addEventListener("resize", () => { isMobile = window.innerWidth < 768; });

  // Initialise bottom‑sheet drag & tab switching
  initBottomSheetDrag();
}

// ──────────────────────────────────────────────
// 4. Marker Management
// ──────────────────────────────────────────────

/** Icon colours per category */
function markerIcon(category) {
  const colours = {
    food:    "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
    library: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    block:   "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
    ground:  "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
  };
  return colours[category] || "http://maps.google.com/mapfiles/ms/icons/purple-dot.png";
}

/** Place markers on the map for a given list of locations */
function placeMarkers(locations) {
  // Remove old markers
  clearMarkers();

  locations.forEach((loc) => {
    const marker = new google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map: map,
      title: loc.name,
      icon: markerIcon(loc.category),
      animation: google.maps.Animation.DROP,
    });

    // Click → show info window
    marker.addListener("click", () => {
      const distText = userPosition
        ? `📏 ${haversineDistance(userPosition, loc).toFixed(2)} km away`
        : "";
      infoWindow.setContent(`
        <div style="font-family:Inter,sans-serif;max-width:200px">
          <strong>${loc.name}</strong><br/>
          <span style="text-transform:capitalize;color:#555">${loc.category}</span><br/>
          <span style="font-size:0.85em;color:#1a237e">${distText}</span>
        </div>
      `);
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  });
}

/** Remove all campus markers from the map */
function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
}

// ──────────────────────────────────────────────
// 5. User Geolocation
// ──────────────────────────────────────────────
function requestUserLocation() {
  const statusEl = document.getElementById("rec-status");
  const statusElMobile = document.getElementById("rec-status-mobile");

  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = "Geolocation not supported by your browser.";
    if (statusElMobile) statusElMobile.textContent = "Geolocation not supported.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Place user marker (blue circle)
      userMarker = new google.maps.Marker({
        position: userPosition,
        map: map,
        title: "You are here",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        zIndex: 999,
      });

      if (statusEl) statusEl.textContent = "Showing nearest places:";
      if (statusElMobile) statusElMobile.textContent = "Showing locations near you";
      updateRecommendations();
    },
    (err) => {
      console.warn("Geolocation error:", err.message);
      if (statusEl) statusEl.textContent = "Location denied. Showing all.";
      if (statusElMobile) statusElMobile.textContent = "Location denied. Showing all.";
      updateRecommendations();
    }
  );
}

// ──────────────────────────────────────────────
// 6. Haversine Distance Formula
// ──────────────────────────────────────────────

/**
 * Calculate distance (km) between two { lat, lng } points
 * using the Haversine formula.
 */
function haversineDistance(pos1, pos2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(pos2.lat - pos1.lat);
  const dLng = toRad(pos2.lng - pos1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(pos1.lat)) *
      Math.cos(toRad(pos2.lat)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ──────────────────────────────────────────────
// 7. Recommendations Panel
// ──────────────────────────────────────────────

/** Build & display the nearest locations in BOTH desktop and mobile panels */
function updateRecommendations() {
  const listEl       = document.getElementById("rec-list");
  const listElMobile = document.getElementById("rec-list-mobile");
  const statusEl     = document.getElementById("rec-status");
  const statusElMobile = document.getElementById("rec-status-mobile");

  // Filter by active category
  let filtered = activeCategory === "all"
    ? [...campusLocations]
    : campusLocations.filter((l) => l.category === activeCategory);

  if (!userPosition) {
    if (statusEl) statusEl.textContent = "Enable location to see nearby places.";
    if (statusElMobile) statusElMobile.textContent = "Enable location to see nearby places.";
    // Show all without distance
    if (listEl) { listEl.innerHTML = filtered.map(buildDesktopCard).join(""); addListClickListeners(listEl); }
    if (listElMobile) { listElMobile.innerHTML = filtered.map(buildMobileCard).join(""); addListClickListeners(listElMobile); }
    return;
  }

  // Attach distance & sort ascending
  filtered = filtered
    .map((loc) => ({ ...loc, dist: haversineDistance(userPosition, loc) }))
    .sort((a, b) => a.dist - b.dist);

  // Take top 10
  const topItems = filtered.slice(0, 10);

  const statusText = `Showing ${topItems.length} nearest${activeCategory !== "all" ? ` (${activeCategory})` : ""} places`;
  if (statusEl) statusEl.innerText = statusText;
  if (statusElMobile) statusElMobile.innerText = `Showing locations near you`;

  // Desktop sidebar
  if (listEl) {
    listEl.innerHTML = topItems.map(buildDesktopCard).join("");
    addListClickListeners(listEl);
  }
  // Mobile bottom sheet
  if (listElMobile) {
    listElMobile.innerHTML = topItems.map(buildMobileCard).join("");
    addListClickListeners(listElMobile);
  }
}

/** Render the "All Locations" list (no-op in current UI) */
function renderAllLocations(locations) {}

// ─── Desktop Card (existing design) ────────────────────────

function buildDesktopCard(loc) {
  const distLabel = loc.dist != null ? `${loc.dist.toFixed(2)} km away` : "Distance unknown";

  const config = {
    food:    { icon: "restaurant",    bg: "bg-orange-50",  text: "text-accent",       badge: "bg-orange-100 text-orange-800" },
    library: { icon: "local_library", bg: "bg-blue-50",    text: "text-primary",      badge: "bg-blue-100 text-blue-800" },
    block:   { icon: "business",      bg: "bg-indigo-50",  text: "text-indigo-600",   badge: "bg-indigo-100 text-indigo-800" },
    ground:  { icon: "park",          bg: "bg-emerald-50", text: "text-emerald-600",  badge: "bg-emerald-100 text-emerald-800" },
    default: { icon: "place",         bg: "bg-slate-50",   text: "text-slate-600",    badge: "bg-slate-100 text-slate-800" }
  };
  const style = config[loc.category] || config.default;

  return `
    <div class="rec-item group bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer"
         data-lat="${loc.lat}" data-lng="${loc.lng}">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0 h-12 w-12 rounded-full ${style.bg} dark:bg-opacity-10 flex items-center justify-center ${style.text}">
          <span class="material-icons-round">${style.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start">
            <h3 class="font-bold text-slate-900 dark:text-white truncate pr-2 group-hover:text-primary transition-colors">${loc.name}</h3>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge} dark:bg-opacity-20 capitalize">${loc.category}</span>
          </div>
          <div class="flex items-center justify-between mt-3">
            <div class="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span class="material-icons-round text-sm mr-1">near_me</span>
              ${distLabel}
            </div>
            <button class="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full font-medium transition-colors">Navigate</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Mobile Card (Phoneview design) ────────────────────────

function buildMobileCard(loc) {
  const distLabel = loc.dist != null ? `${(loc.dist * 1000).toFixed(0)}m` : "—";
  const saved = isSaved(loc.name);
  const heartIcon = saved ? "favorite" : "favorite_border";
  const heartColor = saved ? "text-rose-500" : "text-slate-300 dark:text-slate-600";

  const config = {
    food:    { icon: "lunch_dining", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400" },
    library: { icon: "menu_book",    bg: "bg-blue-100 dark:bg-blue-900/30",     text: "text-blue-600 dark:text-blue-400" },
    block:   { icon: "apartment",    bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
    ground:  { icon: "stadium",      bg: "bg-green-100 dark:bg-green-900/30",   text: "text-green-600 dark:text-green-400" },
    default: { icon: "place",        bg: "bg-slate-100 dark:bg-slate-700",      text: "text-slate-600 dark:text-slate-400" }
  };
  const style = config[loc.category] || config.default;
  const safeName = loc.name.replace(/'/g, "\\'");

  return `
    <div class="rec-item group bg-white dark:bg-slate-800 p-4 rounded-xl shadow-soft border border-slate-100 dark:border-slate-700/50 flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer"
         data-lat="${loc.lat}" data-lng="${loc.lng}">
      <div class="flex items-center gap-3">
        <div class="h-11 w-11 rounded-full ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0">
          <span class="material-icons text-xl">${style.icon}</span>
        </div>
        <div class="min-w-0">
          <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">${loc.name}</h3>
          <span class="text-xs text-slate-400 capitalize">${loc.category}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-xs font-bold text-primary dark:text-blue-300 bg-primary/10 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">${distLabel}</span>
        <button class="save-btn h-8 w-8 rounded-full flex items-center justify-center transition-colors ${heartColor}" onclick="event.stopPropagation(); toggleSave('${safeName}')">
          <span class="material-icons text-lg">${heartIcon}</span>
        </button>
        <button class="h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-primary hover:text-white dark:hover:bg-primary flex items-center justify-center transition-colors text-slate-400" onclick="event.stopPropagation();">
          <span class="material-icons text-sm">near_me</span>
        </button>
      </div>
    </div>`;
}

/** Click a list item → pan + zoom to that marker and open its InfoWindow */
function addListClickListeners(listEl) {
  listEl.querySelectorAll(".rec-item").forEach((item) => {
    item.addEventListener("click", () => {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      map.panTo({ lat, lng });
      map.setZoom(18);

      // Find matching marker and trigger click
      const match = markers.find(
        (m) =>
          m.getPosition().lat().toFixed(5) === lat.toFixed(5) &&
          m.getPosition().lng().toFixed(5) === lng.toFixed(5)
      );
      if (match) google.maps.event.trigger(match, "click");
    });
  });
}

// ──────────────────────────────────────────────
// 8. Category Filter Buttons
// ──────────────────────────────────────────────
function initFilterButtons() {
  // Updated selector to match new HTML buttons which have 'filter-btn' class
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;

      // Sync active class across BOTH mobile & desktop button sets
      buttons.forEach((b) => {
        b.classList.toggle("active", b.dataset.category === activeCategory);
      });

      // Filter markers on map
      const filtered =
        activeCategory === "all"
          ? campusLocations
          : campusLocations.filter((l) => l.category === activeCategory);

      placeMarkers(filtered);

      // Update panel
      updateRecommendations();
    });
  });
}

// ──────────────────────────────────────────────
// 9. Bottom Sheet Drag Gesture
// ──────────────────────────────────────────────

function initBottomSheetDrag() {
  const sheet  = document.getElementById("mobile-sheet");
  const handle = document.getElementById("sheet-handle");
  if (!sheet || !handle) return;

  const NAV_HEIGHT = 56;                   // bottom nav bar height
  const SNAP_COLLAPSED = 0.12;             // 12% — just the handle visible
  const SNAP_HALF      = 0.36;             // 36% — default half-open
  const SNAP_FULL      = 0.85;             // 85% — fully expanded

  let startY = 0;
  let startH = 0;
  let dragging = false;
  let parentH  = 0;

  function setHeight(frac) {
    sheet.style.height = `${Math.round(frac * 100)}%`;
  }

  // TOUCH events
  handle.addEventListener("touchstart", (e) => {
    dragging = true;
    startY   = e.touches[0].clientY;
    parentH  = sheet.parentElement.getBoundingClientRect().height;
    startH   = sheet.getBoundingClientRect().height / parentH;
    sheet.style.transition = "none";
  }, { passive: true });

  handle.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const dy    = startY - e.touches[0].clientY;
    const delta = dy / parentH;
    let newH    = Math.min(SNAP_FULL, Math.max(SNAP_COLLAPSED, startH + delta));
    setHeight(newH);
  }, { passive: true });

  handle.addEventListener("touchend", (e) => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "height 0.3s ease-out";
    // Snap to nearest breakpoint
    const curH = sheet.getBoundingClientRect().height / parentH;
    const snaps = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL];
    const closest = snaps.reduce((a, b) => Math.abs(b - curH) < Math.abs(a - curH) ? b : a);
    setHeight(closest);
  });

  // MOUSE events (for desktop testing in responsive mode)
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startY   = e.clientY;
    parentH  = sheet.parentElement.getBoundingClientRect().height;
    startH   = sheet.getBoundingClientRect().height / parentH;
    sheet.style.transition = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dy    = startY - e.clientY;
    const delta = dy / parentH;
    let newH    = Math.min(SNAP_FULL, Math.max(SNAP_COLLAPSED, startH + delta));
    setHeight(newH);
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "height 0.3s ease-out";
    const curH = sheet.getBoundingClientRect().height / parentH;
    const snaps = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL];
    const closest = snaps.reduce((a, b) => Math.abs(b - curH) < Math.abs(a - curH) ? b : a);
    setHeight(closest);
  });
}

// ──────────────────────────────────────────────
// 10. Tab Switching (Mobile Bottom Nav)
// ──────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;

  // Toggle tab panels
  const tabs = ["explore", "saved", "alerts", "profile"];
  tabs.forEach((t) => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.toggle("hidden", t !== tab);
  });

  // Toggle nav‑button active styling
  document.querySelectorAll("#bottom-nav .nav-tab").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("text-primary", isActive);
    btn.classList.toggle("dark:text-blue-400", isActive);
    btn.classList.toggle("text-slate-500", !isActive);
    btn.classList.toggle("dark:text-slate-400", !isActive);
  });

  // Show/hide mobile filters (only in explore tab)
  const filterBar = document.querySelector(".md\\:hidden.absolute.top-\\[68px\\]");
  if (filterBar) filterBar.style.display = tab === "explore" ? "" : "none";

  // Show/hide locate FAB (only in explore tab)
  const locBtn = document.getElementById("locate-btn");
  if (locBtn) locBtn.style.display = tab === "explore" ? "" : "none";

  // When switching to Saved tab, rebuild the saved list
  if (tab === "saved") renderSavedList();

  // Ensure sheet is at least half-open when switching tabs
  const sheet = document.getElementById("mobile-sheet");
  if (sheet) {
    const parentH = sheet.parentElement.getBoundingClientRect().height;
    const curFrac = sheet.getBoundingClientRect().height / parentH;
    if (curFrac < 0.30) {
      sheet.style.transition = "height 0.3s ease-out";
      sheet.style.height = "36%";
    }
  }
}

// ──────────────────────────────────────────────
// 11. Saved Places
// ──────────────────────────────────────────────

function isSaved(locName) {
  return savedPlaces.includes(locName);
}

function toggleSave(locName) {
  if (isSaved(locName)) {
    savedPlaces = savedPlaces.filter((n) => n !== locName);
  } else {
    savedPlaces.push(locName);
  }
  localStorage.setItem("cu_saved", JSON.stringify(savedPlaces));
  // Refresh both lists so heart icons update
  updateRecommendations();
  if (activeTab === "saved") renderSavedList();
}

function renderSavedList() {
  const listEl = document.getElementById("saved-list");
  if (!listEl) return;

  const savedLocs = campusLocations
    .filter((l) => isSaved(l.name))
    .map((l) => (userPosition ? { ...l, dist: haversineDistance(userPosition, l) } : l));

  const emptyHTML = `
    <div id="saved-empty" class="flex flex-col items-center justify-center py-10 text-center">
      <div class="h-16 w-16 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4">
        <span class="material-icons text-3xl text-rose-400">favorite</span>
      </div>
      <h3 class="font-bold text-slate-700 dark:text-slate-200 text-sm mb-1">No saved places yet</h3>
      <p class="text-xs text-slate-400 max-w-[200px]">Tap the heart icon on any location card to save it here for quick access.</p>
    </div>`;

  if (savedLocs.length === 0) {
    listEl.innerHTML = emptyHTML;
    return;
  }

  listEl.innerHTML = savedLocs.map(buildMobileCard).join("");
  addListClickListeners(listEl);
}
