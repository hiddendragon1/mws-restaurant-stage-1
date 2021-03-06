let restaurants,
  neighborhoods,
  cuisines
var map
var markers = []


/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {

  registerServiceWorker();
  fetchNeighborhoods();
  fetchCuisines();

});


registerServiceWorker = () => {
  //check for service worker and register
  if (navigator.serviceWorker) {
    //open and create IDB
    DBHelper.openIDB();
    navigator.serviceWorker.register('/sw.js')
    .then( (resp) => {
      console.log("Service Worker Registerd Successfully!");
    })
    .catch((error) => {
      console.log("Error Registering Service Worker. Please look into it")
    });
  }
  else
    console.log("Service Worker not supported");
}

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();

}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

toggleFavorite = (restaurant) => {

  const favoriteIcon = document.getElementById('favoriteIcon-'+ `${restaurant.id}`);
  const isFavorite = favoriteIcon.innerHTML== "favorite"? true: false

  if(isFavorite) {
    restaurant.is_favorite=false;
    favoriteIcon.innerHTML = "favorite_border";
  }
  else {
    restaurant.is_favorite=true;
    favoriteIcon.innerHTML = "favorite";
  }

  DBHelper.updateRestaurantFavorite( restaurant, (error, response) => {
    self.restaurant = response;
    if(!response){
      console.error(error);
      return;
    };
  });
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');

  //get favorite restaurant and store the id
  DBHelper.getFavoriteRestaurants((error, results) => {

    if(!results) {
      console.error(error);
      return;
    }

    restaurants.forEach(restaurant => {
      if(results.includes(restaurant.id))
        restaurant.is_favorite=true;
      else
        restaurant.is_favorite=false;

      ul.append(createRestaurantHTML(restaurant));
      //add event listener for the favorite icon
      document.getElementById(restaurant.id).addEventListener('click', () => toggleFavorite(restaurant));;
    });
  });

  addMarkersToMap();
  google.maps.event.addListenerOnce(map, 'idle', () => {
    document.getElementsByTagName('iframe')[0].title = "Google Maps";
  });

}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');
  li.setAttribute("tabindex",0);

  // forming the small and medium image name

  if(!restaurant.photograph)
    restaurant.photograph="not-available";

  const imgSmall = restaurant.photograph.concat('-320_small.jpg');
  const imgMedium = restaurant.photograph.concat('-480_medium.jpg');

  const image = document.createElement('img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);

  //add srcset and sizes attribute to image
  image.srcset = "/images/"+ imgSmall + " 320w," + "/images/"+ imgMedium + " 480w," +"/img/"+restaurant.photograph+".jpg" + " 800w" ;
  image.sizes = "(min-width: 100px) and (max-width: 425px) 150px, (min-width: 600px) and (max-width: 716px) 500px, 250px";
  image.alt = `${restaurant.name} restaurant picture`;
  li.append(image);

  const name = document.createElement('h2');
  name.innerHTML = restaurant.name;
  li.append(name);

  // add favorite icon to li list
  const favoriteDiv = document.createElement('div');
  const isFavorite = restaurant.is_favorite ? JSON.parse(restaurant.is_favorite) :false;
  favoriteDiv.classList.add("favoriteToggle");
  favoriteDiv.setAttribute("id", restaurant.id);
  favoriteDiv.setAttribute("aria-label","toggle favorite");

  favoriteDiv.innerHTML = `<i class='material-icons' alt='Favorite Icon' id='favoriteIcon-${restaurant.id}'>${isFavorite?"favorite":"favorite_border"}</i>`;
  li.append(favoriteDiv);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  return li;
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
}


// window.addEventListener('load', registerServiceWorker());

