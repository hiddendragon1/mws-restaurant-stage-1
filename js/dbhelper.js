

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
    return `http://localhost:${port}/restaurants`;
  }

  static openIDB() {
    this._dbPromise = idb.open("part2", 1 , function(upgradedb) {
      const store = upgradedb.createObjectStore('part2', {
        keyPath: 'id'
      });
    });
  }

  //get restaurant from DB Method
  static getRestaurantsFromDB(callback) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('part2', 'readwrite'); //open DB transaction for readwrite
      const store = tx.objectStore('part2');    //get objectstore
      return store.getAll();
    })
    .then(restaurants => callback(null,restaurants))
    .catch(error => callback(error,null));
  }


  //put restaurant JSON to indexDB.
  static putRestaurantsToDB(restaurants) {
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('part2', 'readwrite');
      const store = tx.objectStore('part2');
      Array.isArray(restaurants) ? restaurants.forEach(restaurant => store.put(restaurant)): store.put(restaurants);
    })
    .catch(error => console.log("Error Adding Restaurants to DB:", error));
  }

  // static showCacheIDB() {
  //   const
  // }
  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback,id) {

    //fetch restaurant by ID if id is passed else fetch all restaurants
    const dataURL =id ? DBHelper.DATABASE_URL+`/${id}`: DBHelper.DATABASE_URL;

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

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {

    //fetch from db if available
    this._dbPromise.then(db => {
      if(!db) return;
      const tx = db.transaction('part2');
      const store = tx.objectStore('part2');

      return store.get(parseInt(id));
    })
    .then(restaurant => {
      if(restaurant)
        callback(null,restaurant);
      else
        //fetch from server if not available in DB
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
