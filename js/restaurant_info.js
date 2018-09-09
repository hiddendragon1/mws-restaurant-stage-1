let restaurant;
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  registerServiceWorker();
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
        self.map = new google.maps.Map(document.getElementById('map'), {
          zoom: 16,
          center: restaurant.latlng,
          scrollwheel: false
        });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        document.getElementsByTagName('iframe')[0].title = "Google Maps";
      });

    }
  });


}

registerServiceWorker = () => {
  //check for service worker and register
  if (navigator.serviceWorker) {
    DBHelper.openIDB();
    navigator.serviceWorker.register('/sw.js')
      .then( (resp) => {
        console.log("Service Worker Registerd Successfully!");

        navigator.serviceWorker.addEventListener('message', message => {
          if(message.data.action === 'submitReviews')
            DBHelper.sendSavedReviews();
        });
      })
      .catch((error) => {
        console.log("Error Registering Service Worker. Please look into it")
      });
  }
  else
    console.log("Service Worker not supported");
}

//request Background sync
requestBackgroundSync = (sync) => {
  if (navigator.serviceWorker) {
    console.log("Requesting Sync", sync);
    navigator.serviceWorker.ready.then(function(swRegistration) {
        return swRegistration.sync.register('submitReviewSync');
    });
  }
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.log(error);
        return;
      }
      fillRestaurantHTML();

      //fetch restaurant reviews next
      DBHelper.fetchRestaurantReviews(id, (error,reviews) => {
        if(!reviews){
          console.error(error);
          return;
        }

        if(self.restaurant.reviews)
          updateReviewsHTML(reviews);
        else
          fillReviewsHTML(reviews);
        self.restaurant.reviews = reviews;
      });

      callback(null, restaurant)
    });
  }
}

toggleFavorite = (restaurant) => {

  const isFavorite = document.getElementById('favoriteIcon').innerHTML== "favorite"? true: false
  const favoriteIcon = document.getElementById('favoriteIcon');
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
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  //favorite button
  const isFavorite = restaurant.is_favorite ? JSON.parse(restaurant.is_favorite) :false;
  const favoriteIcon = document.getElementById('favoriteIcon');
  favoriteIcon.innerHTML = isFavorite ? "favorite": "favorite_border";

  //add event listener for the favorite icon
  document.getElementById('favorite').addEventListener('click', () => toggleFavorite(restaurant));;


  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  if(!restaurant.photograph)
    restaurant.photograph="not-available";

  // forming the small image name
  const imgSmall = restaurant.photograph.concat('-320_small.jpg');
  const picture = document.getElementById('restaurant-picture');

  // create source element and add small image source for responsive picture
  const smallSource = document.createElement('source');
  smallSource.media = "(min-width: 651px) and (max-width: 800px), (max-width: 350px)"
  smallSource.srcset = "/images/"+ imgSmall;
  picture.prepend(smallSource);

  //responsive images for large image
  const largeSource = document.createElement('source');
  largeSource.media = "(min-width: 801px), (max-width: 650px) and (min-width: 550px)"
  largeSource.srcset = "/img/"+restaurant.photograph+".jpg";
  picture.prepend(largeSource);

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = `${restaurant.name} restaurant picture`;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');
    row.setAttribute("tabindex",0);

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

updateReviewsHTML = (reviews) => {
  //filter review for those not display on screen yet
  reviews = reviews.filter(x => {
    self.restaurant.reviews.forEach(y => {
      if(x.id == y.id)
        return false;
    })
  })

  //prepend the review list
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.prepend(createReviewHTML(review));
  });
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews) => {
  console.log("filling review",reviews);
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews || !reviews.length) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }

  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.prepend(createReviewHTML(review));
  });
  container.appendChild(ul);
}


//For User to submit review
onSubmitReview = (e) => {
  e.preventDefault();
  const formArray = document.getElementById("reviewForm");

  //formData fot JSON object
  var returnArray = {"restaurant_id": self.restaurant.id,"createdAt":Date.now(),"updatedAt":Date.now() };
  for (let i = 0; i < formArray.length-1; i++){
    returnArray[formArray[i]['name']] = formArray[i]['value'];
  }

  //call API to submit review
  DBHelper.postRestaurantReview(returnArray,(error,review) => {

    self.restaurant.reviews.push(returnArray);
    const ul = document.getElementById('reviews-list');
    ul.prepend(createReviewHTML(returnArray));

    //if error request background sync and save review for later
    if(!review){
       console.error(error);
       requestBackgroundSync('submitReviewSync');
       DBHelper.saveReviews(returnArray);
    }

  });

}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  li.setAttribute("tabindex",0);

  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.createdAt).toUTCString();
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
