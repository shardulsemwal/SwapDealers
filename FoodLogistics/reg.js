// Initialize map and marker variables
let map;
let deliveryMarker = null;
let customerMarker = null;
let routingControl = null;
let routeLine = null;
let markers = [];

// DOM elements for displaying distance/time and directions
const distanceTimeEl = document.getElementById('distance-time');
const directionsListEl = document.getElementById('directions-list');

// Predefined locations and graph for Dijkstra's algorithm
const locations = {
  GraphicEra: [30.2705, 78.0796],
  ISBT: [30.2849, 78.0793],
  ClockTower: [30.3255, 78.0437],
  Rajpur: [30.3792, 78.0806]
};

const graph = {
  GraphicEra: { ISBT: 4, ClockTower: 2 },
  ISBT: { ClockTower: 3, Rajpur: 6 },
  ClockTower: { Rajpur: 2 },
  Rajpur: { GraphicEra: 5 }
};

let restaurants = []; 

// Custom pulse icon for live delivery marker
const PulseIcon = L.DivIcon.extend({
  options: {
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    html: '<div class="pulse-marker"></div>'
  }
});

// Initialize the map centered on Dehradun
function initUnifiedMap() {
  map = L.map('map').setView([30.3165, 78.0322], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}
initUnifiedMap();

// Handle restaurant registration form submission
document.getElementById("restaurantForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const location = document.getElementById("location").value;
  const phone = document.getElementById("phone").value;
  const menu = document.getElementById("menu").value;

  // Geocode the restaurant location using Nominatim API
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location + ', Dehradun, Uttarakhand, India')}&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        alert("Restaurant address not found. Please enter a valid address in Dehradun.");
        return;
      }
      const place = data[0];
      if (!place.display_name.toLowerCase().includes("dehradun")) {
        alert("Location not found in Dehradun. Please enter a more specific address.");
        return;
      }
      const coord = [parseFloat(place.lat), parseFloat(place.lon)];
      locations[location] = coord;
      const restaurant = { name, location, cuisine: menu.split(',')[0] || "", phone, menu };
      restaurants.push(restaurant);

      // Save to localStorage for main page search
      let stored = JSON.parse(localStorage.getItem('registeredRestaurants') || "[]");
      stored.push({ name, location, cuisine: menu.split(',')[0] || "" }); // <-- use location
      localStorage.setItem('registeredRestaurants', JSON.stringify(stored));

      displayRestaurants();
      addMarker(restaurant, coord);
      e.target.reset();
    })
    .catch(() => {
      alert("Error geocoding restaurant address. Please try again.");
    });
});

// Display the list of registered restaurants
function displayRestaurants() {
  const ul = document.getElementById("restaurantDisplay");
  ul.innerHTML = "";
  restaurants.forEach((r, idx) => {
    const li = document.createElement("li");
    li.textContent = `${r.name} (${r.location}) - ${r.phone}, Menu: ${r.menu} `;

    // Add navigation button for delivery boy
    const navBtn = document.createElement("button");
    navBtn.textContent = "Navigate to Restaurant";
    navBtn.style.marginLeft = "10px";
    navBtn.onclick = () => showRouteToRestaurant(r);

    li.appendChild(navBtn);
    ul.appendChild(li);
  });
}

// Add a marker for a restaurant on the map
function addMarker(restaurant, coord) {
  const marker = L.marker(coord).addTo(map).bindPopup(`${restaurant.name} (${restaurant.location})`);
  markers.push(marker);
}


// Find shortest paths from start node using Dijkstra's algorithm
function dijkstra(graph, start) {
  const dist = {}, prev = {}, visited = new Set(), pq = [];

  for (let node in graph) {
    dist[node] = Infinity;
    prev[node] = null;
  }

  dist[start] = 0;
  pq.push([0, start]);

  while (pq.length > 0) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, node] = pq.shift();
    if (visited.has(node)) continue;
    visited.add(node);

    for (let neighbor in graph[node]) {
      const alt = d + graph[node][neighbor];
      if (alt < dist[neighbor]) {
        dist[neighbor] = alt;
        prev[neighbor] = node;
        pq.push([alt, neighbor]);
      }
    }
  }

  return { dist, prev };
}

// Build the path from prev object returned by Dijkstra
function buildPath(prev, end) {
  const path = [];
  while (end) {
    path.unshift(end);
    end = prev[end];
  }
  return path;
}

let lastNearestRestaurant = null;
let lastCustomerCoord = null;


// Find the nearest restaurant to the user's address
function findNearest() {
  const userAddress = document.getElementById("userAddress").value.trim();
  const result = document.getElementById("result");

  if (!userAddress) {
    result.textContent = "Please enter your address.";
    return;
  }

  // Geocode the user's address
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(userAddress + ', Dehradun')}&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        result.textContent = "Address not found. Please try again.";
        return;
      }
      const userCoord = [parseFloat(data[0].lat), parseFloat(data[0].lon)];

      // Find nearest restaurant by straight-line distance
      let nearest = null, minDist = Infinity;
      restaurants.forEach(r => {
        const coord = locations[r.location];
        if (coord) {
          const dist = Math.sqrt(
            Math.pow(coord[0] - userCoord[0], 2) + Math.pow(coord[1] - userCoord[1], 2)
          );
          if (dist < minDist) {
            minDist = dist;
            nearest = r;
          }
        }
      });

      if (nearest) {
        result.textContent = `Nearest Restaurant: ${nearest.name} (${nearest.location}), Phone: ${nearest.phone}, Menu: ${nearest.menu}`;
        
        const coord = locations[nearest.location];
        if (coord) {
          map.setView(coord, 15);
          markers.forEach(marker => {
            if (marker.getLatLng().lat === coord[0] && marker.getLatLng().lng === coord[1]) {
              marker.openPopup();
            }
          });
        }
      } else {
        result.textContent = "No restaurant found near your location.";
      }
    })
    .catch(() => {
      result.textContent = "Error finding address. Please try again.";
    });
}


// Draw both routes
function drawDeliveryRoutes(restaurantCoord, customerCoord, deliveryCoord) {
  if (routeLine) map.removeLayer(routeLine);

  // Remove previous polylines if any
  if (window.restaurantToCustomerLine) map.removeLayer(window.restaurantToCustomerLine);
  if (window.customerToDeliveryLine) map.removeLayer(window.customerToDeliveryLine);

  // Draw restaurant -> customer
  window.restaurantToCustomerLine = L.polyline([restaurantCoord, customerCoord], { color: 'green', weight: 5 }).addTo(map);
  // Draw customer -> delivery boy
  window.customerToDeliveryLine = L.polyline([customerCoord, deliveryCoord], { color: 'blue', weight: 5, dashArray: '8 8' }).addTo(map);

  map.fitBounds(L.featureGroup([window.restaurantToCustomerLine, window.customerToDeliveryLine]).getBounds());

  distanceTimeEl.textContent = `Green: Restaurant → Customer | Blue: Customer → Delivery Boy`;
  directionsListEl.innerHTML = `
    <li>Restaurant to Customer</li>
    <li>Customer to Delivery Boy (Live Location)</li>
  `;
}

// Geocode customer address and draw both routes
function geocodeAddressForDelivery(address, deliveryLat, deliveryLon) {
  if (!address.trim()) {
    alert('Please enter a valid address.');
    return;
  }
  // Use lastNearestRestaurant, or fallback to last registered restaurant
  let restaurant = lastNearestRestaurant;
  if (!restaurant && restaurants.length > 0) {
    restaurant = restaurants[restaurants.length - 1];
  }
  if (!restaurant) {
    alert('No restaurant available. Please register a restaurant first.');
    return;
  }
  const restaurantCoord = locations[restaurant.location];
  if (!restaurantCoord) {
    alert('Restaurant location not found on the map.');
    return;
  }
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Dehradun, Uttarakhand, India')}&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        alert('Address not found. Try again.');
        return;
      }
      const { lat, lon } = data[0];
      const customerCoord = [parseFloat(lat), parseFloat(lon)];
      // Only show the route from restaurant to customer
      drawRouteRestaurantToCustomer(restaurantCoord, customerCoord);
    })
    .catch(err => {
      console.error('Geocoding failed:', err);
      alert('Failed to locate address.');
    });
}

// Remove previous route and customer marker
function clearRouteAndMarker() {
  if (routingControl) {
    routingControl.off('routesfound');
    routingControl.off('routingerror');
    routingControl.remove();
    routingControl = null;
  }
  if (customerMarker) {
    map.removeLayer(customerMarker);
    customerMarker = null;
  }
  distanceTimeEl.textContent = "Enter customer address and click Track Order";
  directionsListEl.innerHTML = "";
}

// Format seconds to readable time
function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  let mins = Math.floor(seconds / 60);
  let hrs = Math.floor(mins / 60);
  mins %= 60;
  return hrs ? `${hrs} hr ${mins} min` : `${mins} min`;
}

// Format meters to readable distance
function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

// Draw route from delivery boy to customer using Leaflet Routing Machine
function drawRouteToCustomer(customerLat, customerLon, deliveryLat, deliveryLon) {
  clearRouteAndMarker();

  customerMarker = L.marker([customerLat, customerLon], { title: 'Customer Location' })
    .addTo(map)
    .bindPopup("Customer")
    .openPopup();

  routingControl = L.Routing.control({
    waypoints: [L.latLng(deliveryLat, deliveryLon), L.latLng(customerLat, customerLon)],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    show: false,
    createMarker: () => null,
    lineOptions: {
      styles: [{ color: '#ff6b6b', opacity: 0.85, weight: 6 }]
    }
  })
    .on('routesfound', function (e) {
      const summary = e.routes[0].summary;
      distanceTimeEl.textContent = `Distance: ${formatDistance(summary.totalDistance)} | Estimated Time: ${formatTime(summary.totalTime)}`;

      // Extract step-by-step instructions
      let instructions = [];
      if (e.routes[0].instructions && e.routes[0].instructions.length) {
        // Old API
        instructions = e.routes[0].instructions.map(inst => {
          const temp = document.createElement('div');
          temp.innerHTML = inst.text;
          return temp.textContent || temp.innerText || "";
        });
      } else if (e.routes[0].segments && e.routes[0].segments.length) {
        // New API
        e.routes[0].segments.forEach(segment => {
          segment.steps.forEach(step => {
            instructions.push(step.instruction);
          });
        });
      }

      directionsListEl.innerHTML = instructions.length
        ? instructions.map(step => `<li>${step}</li>`).join("")
        : "<li>No detailed directions available.</li>";
    })
    .on('routingerror', function (e) {
      alert("Routing error: Could not calculate route.");
      clearRouteAndMarker();
    })
    .addTo(map);
}

// Geocode address and draw route to customer
function geocodeAddress(address, deliveryLat, deliveryLon) {
  if (!address.trim()) {
    alert('Please enter a valid address.');
    return;
  }

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        alert('Address not found. Try again.');
        return;
      }
      const { lat, lon } = data[0];
      drawRouteToCustomer(parseFloat(lat), parseFloat(lon), deliveryLat, deliveryLon);
    })
    .catch(err => {
      console.error('Geocoding failed:', err);
      alert('Failed to locate address.');
    });
}


// Start live tracking of delivery boy's location
function startLiveDeliveryTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  const addressInput = document.getElementById("address-input");
  const searchButton = document.getElementById("search-btn");

  let deliveryLat = null, deliveryLon = null;

  navigator.geolocation.watchPosition(
    (pos) => {
      deliveryLat = pos.coords.latitude;
      deliveryLon = pos.coords.longitude;

      // Update or create delivery marker
      if (!deliveryMarker) {
        deliveryMarker = L.marker([deliveryLat, deliveryLon], {
          icon: new PulseIcon(),
          title: "Delivery Boy Location"
        }).addTo(map).bindPopup("Delivery Boy (Live Location)").openPopup();
      } else {
        deliveryMarker.setLatLng([deliveryLat, deliveryLon]);
      }

      map.setView([deliveryLat, deliveryLon]);

      addressInput.disabled = false;
      searchButton.disabled = false;

      // On clicking "Track Order", geocode customer address and show route
      searchButton.onclick = function () {
        if (deliveryLat === null || deliveryLon === null) {
          alert("Waiting for location...");
          return;
        }
        const customerAddress = addressInput.value.trim();
        if (!customerAddress) {
          alert("Please enter a customer address.");
          return;
        }
        // Geocode customer address and show route from delivery boy to customer
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customerAddress + ', Dehradun, Uttarakhand, India')}&limit=1`)
          .then(res => res.json())
          .then(data => {
            if (!data.length) {
              alert("Customer address not found. Please try again.");
              return;
            }
            const customerCoord = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            showRouteDeliveryToCustomer([deliveryLat, deliveryLon], customerCoord);
          })
          .catch(() => {
            alert("Error geocoding customer address. Please try again.");
          });
      };
    },
    (err) => {
      alert("Location error: " + err.message);
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

// Draw a route on the map using a path of location names
function drawRouteForGraph(path) {
  // Remove previous route line if any
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  // Convert node names to coordinates
  const latlngs = path.map(loc => locations[loc]);
  // Draw polyline if path is valid
  if (latlngs.length > 1) {
    routeLine = L.polyline(latlngs, { color: 'orange', weight: 5 }).addTo(map);
    map.fitBounds(routeLine.getBounds());
    distanceTimeEl.textContent = `Route: ${path.join(" → ")}`;
    directionsListEl.innerHTML = path.map(p => `<li>${p}</li>`).join("");
  }
}

// Show route from delivery boy to restaurant
function showRouteToRestaurant(restaurant) {
  if (!deliveryMarker) {
    alert("Delivery boy location not available yet.");
    return;
  }
  const deliveryLatLng = deliveryMarker.getLatLng();
  const restaurantCoord = locations[restaurant.location];
  if (!restaurantCoord) {
    alert("Restaurant location not found.");
    return;
  }

  // Remove previous routing if any
  clearRouteAndMarker();

  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(deliveryLatLng.lat, deliveryLatLng.lng),
      L.latLng(restaurantCoord[0], restaurantCoord[1])
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    show: false,
    createMarker: () => null,
    lineOptions: {
      styles: [{ color: '#28a745', opacity: 0.85, weight: 6 }]
    }
  })
    .on('routesfound', function (e) {
      const summary = e.routes[0].summary;
      distanceTimeEl.textContent = `Distance: ${formatDistance(summary.totalDistance)} | Estimated Time: ${formatTime(summary.totalTime)}`;

      // Extract step-by-step instructions
      let instructions = [];
      if (e.routes[0].instructions && e.routes[0].instructions.length) {
    
        instructions = e.routes[0].instructions.map(inst => {
          const temp = document.createElement('div');
          temp.innerHTML = inst.text;
          return temp.textContent || temp.innerText || "";
        });
      } else if (e.routes[0].segments && e.routes[0].segments.length) {
      
        e.routes[0].segments.forEach(segment => {
          segment.steps.forEach(step => {
            instructions.push(step.instruction);
          });
        });
      }

      directionsListEl.innerHTML = instructions.length
        ? instructions.map(step => `<li>${step}</li>`).join("")
        : "<li>No detailed directions available.</li>";
    })
    .on('routingerror', function () {
      alert("Routing error: Could not calculate route.");
      clearRouteAndMarker();
    })
    .addTo(map);
}

// Show route from delivery boy to customer
function showRouteDeliveryToCustomer(deliveryCoord, customerCoord) {
  clearRouteAndMarker();

  customerMarker = L.marker(customerCoord, { title: 'Customer Location' })
    .addTo(map)
    .bindPopup("Customer")
    .openPopup();

  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(deliveryCoord[0], deliveryCoord[1]),
      L.latLng(customerCoord[0], customerCoord[1])
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    show: false,
    createMarker: () => null,
    lineOptions: {
      styles: [{ color: '#ff6b6b', opacity: 0.85, weight: 6 }]
    }
  })
    .on('routesfound', function (e) {
      const summary = e.routes[0].summary;
      distanceTimeEl.textContent = `Distance: ${formatDistance(summary.totalDistance)} | Estimated Time: ${formatTime(summary.totalTime)}`;

      // Extract step-by-step instructions
      let instructions = [];
      if (e.routes[0].instructions && e.routes[0].instructions.length) {
      
        instructions = e.routes[0].instructions.map(inst => {
          const temp = document.createElement('div');
          temp.innerHTML = inst.text;
          return temp.textContent || temp.innerText || "";
        });
      } else if (e.routes[0].segments && e.routes[0].segments.length) {
    
        e.routes[0].segments.forEach(segment => {
          segment.steps.forEach(step => {
            instructions.push(step.instruction);
          });
        });
      }

      directionsListEl.innerHTML = instructions.length
        ? instructions.map(step => `<li>${step}</li>`).join("")
        : "<li>No detailed directions available.</li>";
    })
    .on('routingerror', function () {
      alert("Routing error: Could not calculate route.");
      clearRouteAndMarker();
    })
    .addTo(map);
}


// Modal logic for login and signup popups
const loginModal = document.getElementById('login-modal');
const signupModal = document.getElementById('signup-modal');
document.querySelector('.btn-login').onclick = () => loginModal.style.display = 'block';
document.querySelector('.btn-signup').onclick = () => signupModal.style.display = 'block';
document.getElementById('close-login').onclick = () => loginModal.style.display = 'none';
document.getElementById('close-signup').onclick = () => signupModal.style.display = 'none';
window.onclick = function (event) {
  if (event.target === loginModal) loginModal.style.display = 'none';
  if (event.target === signupModal) signupModal.style.display = 'none';
};
// Prevent default form submission for demo
document.getElementById('login-form').onsubmit = e => { e.preventDefault(); alert('Logged in!'); loginModal.style.display = 'none'; };
document.getElementById('signup-form').onsubmit = e => { e.preventDefault(); alert('Signed up!'); signupModal.style.display = 'none'; };

// Start live tracking as soon as the page loads
window.addEventListener('DOMContentLoaded', () => {
  startLiveDeliveryTracking();
});
