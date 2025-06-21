
let restaurants = [
    { name: "Pizza Palace", address: "Clock Tower", cuisine: "Pizza" },
    { name: "Spicy Bites", address: "ISBT", cuisine: "Indian" },
    { name: "Burger Hub", address: "Rajpur", cuisine: "Burgers" }
];

// Load restaurants from localStorage (added via reg.html)
const stored = JSON.parse(localStorage.getItem('registeredRestaurants') || "[]");
restaurants = restaurants.concat(stored);

// Sort for binary search (by name)
restaurants.sort((a, b) => a.name.localeCompare(b.name));

// Binary search by name (exact match, case-insensitive)
function binarySearchRestaurantByName(arr, query) {
    let left = 0, right = arr.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const name = arr[mid].name.toLowerCase();
        if (name === query) {
            return arr[mid];
        } else if (name < query) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return null;
}

// Linear search for partial/cuisine/address match (case-insensitive)
function linearSearchRestaurants(arr, query) {
    return arr.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.address.toLowerCase().includes(query) ||
        r.cuisine.toLowerCase().includes(query)
    );
}

// Handle search button click in section
document.getElementById('hero-search-btn').onclick = function () {
    const query = document.getElementById('hero-search-input').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = "";

    if (!query) {
        resultsDiv.textContent = "Please enter a search term.";
        return;
    }

    // Try binary search for exact name
    const found = binarySearchRestaurantByName(restaurants, query);
    let results = [];
    if (found) {
        results = [found];
    } else {
        results = linearSearchRestaurants(restaurants, query);
    }

    // Display results
    if (results.length === 0) {
        resultsDiv.textContent = "No restaurants found for your search.";
    } else {
        resultsDiv.innerHTML = "<ul>" + results.map(r =>
            `<li><b>${r.name}</b> (${r.address}) - ${r.cuisine}</li>`
        ).join("") + "</ul>";
    }
};

// Get modal elements
const loginModal = document.getElementById('login-modal');
const signupModal = document.getElementById('signup-modal');

// Show modal on button click
document.querySelector('.btn-login').onclick = () => loginModal.style.display = 'block';
document.querySelector('.btn-signup').onclick = () => signupModal.style.display = 'block';
document.getElementById('close-login').onclick = () => loginModal.style.display = 'none';
document.getElementById('close-signup').onclick = () => signupModal.style.display = 'none';

// Close modals when clicking outside of them
window.onclick = function (event) {
    if (event.target === loginModal) loginModal.style.display = 'none';
    if (event.target === signupModal) signupModal.style.display = 'none';
};
// Prevent default form submission for demo purposes
document.getElementById('login-form').onsubmit = e => { e.preventDefault(); alert('Logged in!'); loginModal.style.display = 'none'; };
document.getElementById('signup-form').onsubmit = e => { e.preventDefault(); alert('Signed up!'); signupModal.style.display = 'none'; };