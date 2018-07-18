/**
 * Common database helper functions.
 */
class DBHelper {

  static dbPromise() {
    return idb.open('db', 2, function(upgradeDb) {
      switch(upgradeDb.oldVersion) {
        case 0:
          upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
        case 1:
          const reviewsStore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
          reviewsStore.createIndex('restaurant', 'restaurant_id');        
      }
    });
  }

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants() {
    return this.dbPromise()
      .then(db => {
        const tx = db.transaction('restaurants');
        const restaurantStore = tx.objectStore('restaurants');
        return restaurantStore.getAll();
      })
      .then(restaurants => {
        if (restaurants.length !== 0) {
          return Promise.resolve(restaurants);
        }
        return this.fetchAndCacheRestaurants();
      })
  }

  static fetchAndCacheRestaurants() {
    return fetch(DBHelper.DATABASE_URL + 'restaurants')
      .then(response => response.json())
      .then(restaurants => {
        return this.dbPromise()
          .then(db => {
            const tx = db.transaction('restaurants', 'readwrite');
            const restaurantStore = tx.objectStore('restaurants');
            restaurants.forEach(restaurant => restaurantStore.put(restaurant));

            return tx.complete.then(() => Promise.resolve(restaurants));
          });
      });
  }

  /**
   * Fetch all reviews.
   */
  static fetchReviews() {
    return this.dbPromise()
      .then(db => {
        const tx = db.transaction('reviews');
        const reviewStore = tx.objectStore('reviews');
        return reviewStore.getAll();
      })
      .then(reviews => {
        if (reviews.length !== 0) {
          return Promise.resolve(reviews);
        }
        return this.fetchAndCacheReviews();
      })
  }

  static fetchAndCacheReviews() {
    return fetch(DBHelper.DATABASE_URL + 'reviews')
      .then(response => response.json())
      .then(reviews => {
        return this.dbPromise()
          .then(db => {
            const tx = db.transaction('reviews', 'readwrite');
            const restaurantStore = tx.objectStore('reviews');
            reviews.forEach(review => restaurantStore.put(review));

            return tx.complete.then(() => Promise.resolve(reviews));
          });
      });
  }

  static fetchReviewsByRestaurantId(id) {
    return this.fetchReviews().then(reviews => {
      return this.dbPromise().then(db => {
        const tx = db.transaction('reviews');
        const reviewsStore = tx.objectStore('reviews');
        const restaurantIndex = reviewsStore.index('restaurant');
        return restaurantIndex.getAll(id);
      }).then(restaurantReviews => {
        const savedReviews = JSON.parse(localStorage.getItem('SAVED_REVIEWS')) || [];
        const filtered = savedReviews.filter(review => review.restaurant_id === id);
        return restaurantReviews.concat(filtered);
      })
    })
  }

  static insertReview(review) {
    this.dbPromise()
      .then(db => {
        const tx = db.transaction('reviews', 'readwrite');
        const reviewsStore = tx.objectStore('reviews');
        reviewsStore.put(review);
        return tx.complete;
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id) {
    return DBHelper.fetchRestaurants()
      .then(restaurants => restaurants.find(r => r.id === id));
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine) {
    return DBHelper.fetchRestaurants()
      .then(restaurants => restaurants.filter(r => r.cuisine_type === cuisine));
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood) {
    return DBHelper.fetchRestaurants()
      .then(restaurants => restaurants.filter(r => r.neighborhood === neighborhood));
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood) {
    return DBHelper.fetchRestaurants()
      .then(restaurants => {
        let results = restaurants;
        if (cuisine !== 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood !== 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        return results;
      });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods() {
    // Fetch all restaurants
    return DBHelper.fetchRestaurants()
      .then(restaurants => {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        return uniqueNeighborhoods;
      });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    return DBHelper.fetchRestaurants()
      .then(restaurants => {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        return uniqueCuisines;
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
    return `img/${restaurant.id}.jpg`
  }

  /**
   * Map marker for a restaurant.
   */
   static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker  
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
      })
      marker.addTo(newMap);
    return marker;
  }

  static postSavedReviews () {
    if (!navigator.onLine) {
      return;
    }
  
    const savedReviews = JSON.parse(localStorage.getItem('SAVED_REVIEWS')) || [];
    savedReviews.forEach(review => DBHelper.postAndCacheReview(review));
    localStorage.removeItem('SAVED_REVIEWS');
  }

  static postAndCacheReview(payload) {
    fetch(this.DATABASE_URL + 'reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload)
    }).then(response => response.json())
      .then(review => this.insertReview(review));
  }

  static updateFavouriteStatus(restaurantId, isFavourite) {
    fetch(this.DATABASE_URL + `restaurants/${restaurantId}/?is_favorite=${isFavourite}`, {
      method: 'PUT'
    })
    .then(() => {
      this.dbPromise()
        .then(db => {
          const tx = db.transaction('restaurants', 'readwrite');
          const restaurantsStore = tx.objectStore('restaurants');
          restaurantsStore.get(restaurantId)
            .then(restaurant => {
              restaurant.is_favorite = isFavourite;
              restaurantsStore.put(restaurant);
            });          
        })
    })
  }
}

