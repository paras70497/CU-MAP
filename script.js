/* ============================================================
   CU Campus Guide — Main Script
   ============================================================ */

// ──────────────────────────────────────────────
// 1. Predefined Campus Locations
// ──────────────────────────────────────────────
const campusLocations = [
  { name: "CU Main Canteen",        lat: 30.7714, lng: 76.5762, category: "food"    },
  { name: "South Campus Canteen",   lat: 30.7690, lng: 76.5730, category: "food"    },
  { name: "Subway Outlet",          lat: 30.7705, lng: 76.5748, category: "food"    },
  { name: "Domino's CU",            lat: 30.7720, lng: 76.5770, category: "food"    },
  { name: "Library Block",          lat: 30.7700, lng: 76.5755, category: "library" },
  { name: "Digital Library",        lat: 30.7708, lng: 76.5740, category: "library" },
  { name: "Block A",                lat: 30.7710, lng: 76.5735, category: "block"   },
  { name: "Block B",                lat: 30.7718, lng: 76.5728, category: "block"   },
  { name: "Block C",                lat: 30.7725, lng: 76.5742, category: "block"   },
  { name: "Block D",                lat: 30.7698, lng: 76.5760, category: "block"   },
  { name: "Admin Block",            lat: 30.7730, lng: 76.5752, category: "block"   },
  { name: "Basketball Court",       lat: 30.7695, lng: 76.5720, category: "ground"  },
  { name: "Cricket Ground",         lat: 30.7685, lng: 76.5710, category: "ground"  },
  { name: "Football Ground",        lat: 30.7680, lng: 76.5725, category: "ground"  },
  { name: "Tennis Court",           lat: 30.7692, lng: 76.5745, category: "ground"  },
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

// ──────────────────────────────────────────────
// 3. Initialise the Map (Google Maps callback)
// ──────────────────────────────────────────────
function initMap() {
  // CU campus center coordinates
  const cuCenter = { lat: 30.7710, lng: 76.5740 };

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

  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not supported by your browser.";
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

      statusEl.textContent = "Showing 5 nearest places to you:";
      updateRecommendations();
    },
    (err) => {
      console.warn("Geolocation error:", err.message);
      statusEl.textContent = "Location access denied. Showing all locations.";
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

/** Build & display the top 5 nearest locations */
function updateRecommendations() {
  const listEl   = document.getElementById("rec-list");
  const statusEl = document.getElementById("rec-status");

  // Filter by active category
  let filtered = activeCategory === "all"
    ? [...campusLocations]
    : campusLocations.filter((l) => l.category === activeCategory);

  if (!userPosition) {
    statusEl.textContent = "Enable location to see nearby places.";
    // If no location, show all (or filtered) items without distance
    listEl.innerHTML = filtered.map(buildListItem).join("");
    addListClickListeners(listEl);
    return;
  }

  // Attach distance & sort ascending
  filtered = filtered
    .map((loc) => ({ ...loc, dist: haversineDistance(userPosition, loc) }))
    .sort((a, b) => a.dist - b.dist);

  // Take top 10 for the new UI
  const topItems = filtered.slice(0, 10);

  statusEl.innerText = `Showing ${topItems.length} nearest${activeCategory !== "all" ? ` (${activeCategory})` : ""} places`;

  listEl.innerHTML = topItems.map(buildListItem).join("");

  // Add click listeners (pan map to marker)
  addListClickListeners(listEl);
}

/** Render the "All Locations" list (Hidden in new UI but kept for logic) */
function renderAllLocations(locations) {
  // no-op or just update the main list if needed
}

/** HTML for a single list item (Card Style) */
function buildListItem(loc) {
  const distLabel  = loc.dist != null ? `${loc.dist.toFixed(2)} km away` : "Distance unknown";
  
  // Design configuration based on category
  const config = {
    food:    { icon: "restaurant",    bg: "bg-orange-50",    text: "text-accent-orange", badge: "bg-orange-100 text-orange-800" },
    library: { icon: "local_library", bg: "bg-blue-50",      text: "text-primary",       badge: "bg-blue-100 text-blue-800" },
    block:   { icon: "business",      bg: "bg-indigo-50",    text: "text-indigo-600",    badge: "bg-indigo-100 text-indigo-800" },
    ground:  { icon: "park",          bg: "bg-emerald-50",   text: "text-emerald-600",   badge: "bg-emerald-100 text-emerald-800" },
    default: { icon: "place",         bg: "bg-slate-50",     text: "text-slate-600",     badge: "bg-slate-100 text-slate-800" }
  };

  const style = config[loc.category] || config.default;
  const isDark = document.documentElement.classList.contains('dark'); // Check if dark mode is active (simple check)

  // Using Tailwind classes from the new design
  // Added 'group/card' to avoid specified group conflict if any
  return `
    <div class="rec-item group relative bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer"
         data-lat="${loc.lat}" data-lng="${loc.lng}">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0 h-12 w-12 rounded-full ${style.bg} dark:bg-opacity-10 flex items-center justify-center ${style.text}">
          <span class="material-icons-round">${style.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start">
            <h3 class="font-bold text-slate-900 dark:text-white truncate pr-2 group-hover:text-primary transition-colors">${loc.name}</h3>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge} dark:bg-opacity-20 capitalize">
              ${loc.category}
            </span>
          </div>
          <div class="flex items-center justify-between mt-3">
             <div class="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span class="material-icons-round text-sm mr-1">near_me</span>
                ${distLabel}
             </div>
             <button class="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full font-medium transition-colors">
                Navigate
             </button>
          </div>
        </div>
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
      // Toggle active class
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      activeCategory = btn.dataset.category;

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
