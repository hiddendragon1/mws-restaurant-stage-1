/**
 * Common database helper functions.
 */
class DBHelper {

  constructor() {
   this._dbPromise;
  }
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/`;
  }

  static openIDB() {
    this._dbPromise = idb.open("part3", 1 , function(upgradedb) {
      upgradedb.createObjectStore('restaurants', { keyPath: 'id'});
      var restaurantStore = upgradedb.transaction.objectStore('restaurants');
      restaurantStore.createIndex('is_favorite','is_favorite');

      upgradedb.createObjectStore('reviews', { keyPath: 'id' });
      var reviewStore = upgradedb.transaction.objectStore('reviews');
      reviewStore.createIndex('restaurant_id', 'restaurant_id');

      upgradedb.createObjectStore('syncReviews', {keyPath: 'createdAt'});
    });
  }

  //get restaurant from DB Method
  static getRestaurantsFromDB(callback) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('restaurants', 'readwrite'); //open DB transaction for readwrite
      const store = tx.objectStore('restaurants');    //get objectstore
      return store.getAll();
    })
    .then(restaurants => callback(null,restaurants))
    .catch(error => callback(error,null));
  }


  //store restaurant JSON to indexDB.
  static putRestaurantsToDB(restaurants) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('restaurants', 'readwrite');
      const store = tx.objectStore('restaurants');
      Array.isArray(restaurants) ? restaurants.forEach(restaurant => {
        //store only if it updated at or not in indexDb
        store.get(parseInt(restaurant.id)).then(temp =>{
          if(!temp || restaurant.updatedAt > temp.updatedAt) {
            store.put(restaurant);
          }
        });
      }): store.put(restaurants);
    })
    .catch(error => console.log("Error Adding Restaurants to DB:", error));
  }

  //store restaurant JSON to indexDB.
  static putReviewsToDB(reviews) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('reviews', 'readwrite');
      const store = tx.objectStore('reviews');
      Array.isArray(reviews) ? reviews.forEach(reviews => store.put(reviews)): store.put(reviews);
    })
    .catch(error => console.log("Error Adding Reviews to DB:", error));
  }


  //Save review to IDB offline for late
  static saveReviews(review) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('syncReviews', 'readwrite');
      const store = tx.objectStore('syncReviews');
      store.put(review);
    })
    .catch(error => console.log("Error Saving Review to DB:", error));
  }

  //get review from DB for sync
  static sendSavedReviews(callback) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('syncReviews', 'readwrite');
      const store = tx.objectStore('syncReviews');
      //open cursor to go through the review to send
      return store.openCursor();
    })
    .then( function sendToServer(cursor) {

        if (!cursor) return;
        //post saved review to API
        DBHelper.postRestaurantReview(cursor.value, (error,response) => {
          if(!response)
            console.error(error);
        });
        //delete saved review from IDB
        cursor.delete();
        return cursor.continue().then(sendToServer);

    })
    .catch(error => console.log("Error Saving Review to DB:", error));
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback,id) {

     //fetch restaurant by ID if id is passed else fetch all restaurants
    const RestaurantURL = DBHelper.DATABASE_URL + 'restaurants';
    const dataURL =id ? `${RestaurantURL}/${id}`: RestaurantURL;

    //fetch api to get restaurant details from development server
    fetch(dataURL).then((response) => {
      //parse json response and pass restaurants for callback
      if(response && response.status === 200)
        response.json().then(restaurants => {
          //store result json to idb store
          DBHelper.putRestaurantsToDB(restaurants);
          callback(null, restaurants);
        });
      else
        callback('No Restaurants Found', null);
    })
    .catch( err => {
      //if error then return error
      const error = (`Request failed with following error: ${err}`);
      callback(error, null);
    });
  }

  //Favorite and un_favorite a restaurant through API endpoint
  static updateRestaurantFavorite(restaurant, callback) {
    //form the URL
    const url = `${DBHelper.DATABASE_URL}restaurants/${restaurant.id}/?is_favorite=${restaurant.is_favorite}`;

    //call api to update favorite
    fetch(url, { method: 'PUT' }).then((response) => {
      if(response && response.status=== 200)
        response.json().then(restaurants => {
          //store favortie result json to idb store
          DBHelper.putRestaurantsToDB(restaurants);
          callback(null, restaurants);
        });
      else
        callback('Error Updating Favorite', null);
    });
  }


  //get favorite restaurants
  static getFavoriteRestaurants(callback) {
    const url = `${DBHelper.DATABASE_URL}restaurants/?is_favorite=true`;

    //fetch favorite from DB is its there
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');
      var reviewIndex = store.index('is_favorite');

      return reviewIndex.getAll("true");
    })
    .then(favorites => {
      //If reviews are found return it.
      if(favorites.length > 0) {
        const result = [];
          for( let r of favorites) {
            result.push(r.id);
          }

        callback(null,result);
      }
    else
       //else fetch  and store favorite to indexDB if not there already
      fetch(url).then((response) => {
        if(response && response.status === 200)
          response.json().then(restaurants => {
            const result = [];
            for( let r of restaurants) {
              result.push(r.id);
            }
            DBHelper.putRestaurantsToDB(restaurants);
            callback(null, result);
          });
        else
          callback('No Favorites Found', null);
        })
        .catch( err => {
          //if error then return error
          const error = (`Request failed with following error: ${err}`);
          callback(error, null);
        });
      });
  }


  //POST review method to server API through fetch
  static postRestaurantReview(review,callback) {
    const url = `${DBHelper.DATABASE_URL}reviews/`;
    //fetch POST api url
    fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(review),
    })
    .then( (response) => {
      //if got response
      if(response && response.status === 201)
        response.json().then(result => {
          //store returned result to IDB
          DBHelper.putReviewsToDB(result);
          callback(null, result);
        });
      else
        callback('Something went wrong', null);
    })
    .catch( err => {
      //if error then return error
      const error = (`Request failed with following error: ${err}`);
      callback(error,null)
    });;

  }

  //Fetch  reviews from API end point.
  //Get from indexDB is available, if not fetch from api and store in indexDB.
  static fetchRestaurantReviews(id,callback) {
    var networkDataReceived = false;
    //fetch reviews by restaurants id
    const reviewURL = `${DBHelper.DATABASE_URL}reviews/?restaurant_id=${id}`;

    var networkUpdate = fetch(reviewURL).then((response) => {
      if(response && response.status === 200)
        response.json().then(reviews => {
          //store result json to idb store
          DBHelper.putReviewsToDB(reviews);
          networkDataReceived = true;
          callback(null,reviews);
        });
      else
        callback('No Reviews Found', null);
      })
      .catch( err => {
        //if error then return error
        const error = (`Request failed with following error: ${err}`);
        callback(error, null);
    });


    //show cached result first
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('reviews');
      const store = tx.objectStore('reviews');
      var reviewIndex = store.index('restaurant_id');

      return reviewIndex.getAll(parseInt(id));
    })
    .then(reviews => {
      //If reviews are found return it first and before network return
      if(reviews.length > 0 && !networkDataReceived) {
        callback(null,reviews);
      }
    });

  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {

    //fetch from iDB if available
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');

      return store.get(parseInt(id));
    })
    .then(restaurant => {
      if(restaurant) {
        callback(null,restaurant);
      }
      else
        //fetch from server if not available in iDB
        DBHelper.fetchRestaurants((error, restaurants) => {
          if (error) {
            callback(error, null);
          }
          else
            callback(null, restaurants);
        }, id);
    })
    .catch(error => callback(error,null));
  };


  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all from DB
    DBHelper.getRestaurantsFromDB((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants from server
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants from DB to filter for cuisines
    DBHelper.getRestaurantsFromDB((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    //changed to use medium image as default instead
    return (`/images/${restaurant.id}-480_medium.jpg`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }

}
